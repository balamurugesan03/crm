import mongoose from 'mongoose';
import Automation from '../models/Automation.js';
import Task from '../models/Task.js';
import { eventBus } from './eventBus.js';
import { notifyUser } from './notificationService.js';
import { logActivity } from './activityService.js';

const ENTITY_BY_PREFIX = {
  lead: { model: 'Lead', activityType: 'Lead', link: '/leads', label: (r) => r.name },
  deal: { model: 'Deal', activityType: 'Deal', link: '/deals', label: (r) => r.title },
  ticket: { model: 'Ticket', activityType: 'Ticket', link: '/tickets', label: (r) => `${r.ticketNumber} ${r.subject}` },
  contact: { model: 'Contact', activityType: 'Contact', link: '/contacts', label: (r) => `${r.firstName} ${r.lastName || ''}`.trim() },
};

const PROTECTED_FIELDS = new Set(['_id', 'organization', 'createdAt', 'updatedAt', '__v']);

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function evaluateCondition(record, { field, operator, value }) {
  const actual = getPath(record, field);
  const actualStr = actual == null ? '' : String(actual).toLowerCase();
  const expectedStr = String(value ?? '').toLowerCase();
  switch (operator) {
    case 'equals':
      return actualStr === expectedStr;
    case 'not_equals':
      return actualStr !== expectedStr;
    case 'greater_than':
      return Number(actual) > Number(value);
    case 'less_than':
      return Number(actual) < Number(value);
    case 'contains':
      return actualStr.includes(expectedStr);
    default:
      return false;
  }
}

function renderTemplate(text, record, entity) {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (key === 'name') return entity.label(record) ?? '';
    const v = getPath(record, key);
    return v == null ? '' : String(v);
  });
}

function resolveRecipient(assignTo, record, actor) {
  if (assignTo && assignTo !== 'owner' && mongoose.isValidObjectId(assignTo)) return assignTo;
  return record.ownerUser || record.assignedTo || actor?._id;
}

async function runAction(action, ctx) {
  const { organization, record, entity, actor, automation } = ctx;
  const recipient = resolveRecipient(action.assignTo, record, actor);

  switch (action.type) {
    case 'create_task': {
      const due = new Date();
      due.setDate(due.getDate() + (Number(action.taskDueInDays) || 0));
      await Task.create({
        organization,
        title: renderTemplate(action.taskTitle, record, entity) || `Follow up: ${entity.label(record)}`,
        type: 'todo',
        priority: action.taskPriority || 'medium',
        dueDate: due,
        assignedTo: recipient,
        relatedToModel: ['Lead', 'Deal', 'Contact', 'Company'].includes(entity.model) ? entity.model : null,
        relatedToId: ['Lead', 'Deal', 'Contact', 'Company'].includes(entity.model) ? record._id : null,
      });
      break;
    }
    case 'notify_user': {
      if (!recipient) break;
      await notifyUser({
        organization,
        user: recipient,
        type: 'automation',
        title: automation.name,
        body: renderTemplate(action.message, record, entity) || entity.label(record),
        link: entity.link,
      });
      break;
    }
    case 'update_field': {
      if (!action.field || PROTECTED_FIELDS.has(action.field)) break;
      const Model = mongoose.model(entity.model);
      if (!Model.schema.path(action.field)) break;
      await Model.updateOne({ _id: record._id, organization }, { $set: { [action.field]: action.value } }, { runValidators: true });
      break;
    }
    case 'add_note': {
      await logActivity({
        organization,
        entityType: entity.activityType,
        entityId: record._id,
        type: 'automation',
        body: renderTemplate(action.message, record, entity) || `Automation "${automation.name}" ran`,
        createdBy: actor?._id,
      });
      break;
    }
    default:
      break;
  }
}

export async function runAutomationsFor({ name, organization, record, actor }) {
  const entity = ENTITY_BY_PREFIX[name.split('.')[0]];
  if (!entity) return;

  const automations = await Automation.find({ organization, trigger: name, isActive: true });
  for (const automation of automations) {
    const matches = (automation.conditions || []).every((c) => evaluateCondition(record, c));
    if (!matches) continue;
    for (const action of automation.actions) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await runAction(action, { organization, record, entity, actor, automation });
      } catch (err) {
        console.error(`[automation] "${automation.name}" action ${action.type} failed:`, err.message);
      }
    }
    automation.runCount += 1;
    automation.lastRunAt = new Date();
    // eslint-disable-next-line no-await-in-loop
    await automation.save();
  }
}

let registered = false;

export function registerAutomationListeners() {
  if (registered) return;
  registered = true;
  eventBus.on('domain', (event) => {
    const record = typeof event.record?.toObject === 'function' ? event.record.toObject() : event.record;
    runAutomationsFor({ ...event, record }).catch((err) => console.error('[automation] failed', err));
  });
}
