import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Deal from '../models/Deal.js';
import Task from '../models/Task.js';
import Event from '../models/Event.js';
import { computeDealHealth } from './dealHealth.js';
import { notifyUser } from './notificationService.js';
import { markOverdueInvoices, startOfToday } from './invoiceService.js';
import { sendInvoiceReminder } from '../controllers/financeController.js';
import Invoice from '../models/Invoice.js';
import { isSmtpReady } from './messagingService.js';

const DIGEST_HOUR = 9;
const CHECK_EVERY_MS = 15 * 60 * 1000;

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Morning digest: one notification per active user summarising rotting deals,
// overdue tasks and today's meetings. Sent once per day after DIGEST_HOUR (server time).
export async function sendDailyDigests(now = new Date()) {
  if (now.getHours() < DIGEST_HOUR) return 0;
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 864e5);
  let sent = 0;

  const orgs = await Organization.find({ isSuspended: false, 'settings.dailyDigest': { $ne: false } }).select('settings');
  for (const org of orgs) {
    const users = await User.find({
      organization: org._id,
      isActive: true,
      $or: [{ lastDigestAt: null }, { lastDigestAt: { $lt: today } }],
    }).select('_id name');
    if (!users.length) continue;

    const rottingDays = org.settings?.rottingDays || 7;
    const openDeals = await Deal.find({ organization: org._id, status: 'open' }).select('ownerUser amount createdAt lastActivityAt stageChangedAt expectedCloseDate status');

    for (const user of users) {
      const mine = openDeals.filter((d) => String(d.ownerUser) === String(user._id));
      const rotting = mine.filter((d) => computeDealHealth(d, rottingDays, now.getTime()).status === 'rotting');
      // eslint-disable-next-line no-await-in-loop
      const [overdue, meetings] = await Promise.all([
        Task.countDocuments({ organization: org._id, assignedTo: user._id, status: 'pending', dueDate: { $lt: today } }),
        Event.countDocuments({
          organization: org._id,
          status: 'scheduled',
          start: { $gte: today, $lt: tomorrow },
          $or: [{ ownerUser: user._id }, { attendees: user._id }],
        }),
      ]);

      const parts = [];
      if (meetings) parts.push(`${meetings} meeting${meetings > 1 ? 's' : ''} today`);
      if (rotting.length) parts.push(`${rotting.length} deal${rotting.length > 1 ? 's need' : ' needs'} attention`);
      if (overdue) parts.push(`${overdue} overdue task${overdue > 1 ? 's' : ''}`);

      if (parts.length) {
        // eslint-disable-next-line no-await-in-loop
        await notifyUser({
          organization: org._id,
          user: user._id,
          type: 'system',
          title: `Good morning ${user.name.split(' ')[0]} — your day at a glance`,
          body: parts.join(' · '),
          link: rotting.length ? '/deals?health=at_risk' : '/',
        });
        sent += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await User.updateOne({ _id: user._id }, { $set: { lastDigestAt: now } });
    }
  }
  return sent;
}

let timer = null;

// Emails unpaid-invoice reminders N days before due, on the due date, and on configured days after.
export async function sendAutoReminders(now = new Date()) {
  if (now.getHours() < DIGEST_HOUR) return 0;
  const today = startOfToday();
  let sent = 0;
  const orgs = await Organization.find({ isSuspended: false, 'settings.autoReminders': true }).select('settings integrations');
  for (const org of orgs) {
    if (!isSmtpReady(org.integrations?.smtp)) continue;
    const before = org.settings?.reminderBeforeDays ?? 3;
    const after = org.settings?.reminderAfterDays || [1, 7, 15];
    const invoices = await Invoice.find({ organization: org._id, status: { $in: ['sent', 'partially_paid', 'overdue'] }, dueDate: { $ne: null } }).select('dueDate reminders');
    for (const inv of invoices) {
      const days = Math.round((today - new Date(inv.dueDate).setHours(0, 0, 0, 0)) / 864e5);
      const stage = days === -before ? 'before' : days === 0 ? 'due' : after.includes(days) ? 'after' : null;
      if (!stage) continue;
      const alreadyToday = (inv.reminders || []).some((r) => r.auto && new Date(r.sentAt) >= today);
      if (alreadyToday) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await sendInvoiceReminder({ organization: org._id, invoiceId: inv._id, channel: 'email', auto: true, stage });
        sent += 1;
      } catch (err) {
        console.error('[scheduler] reminder failed', String(inv._id), err.message);
      }
    }
  }
  return sent;
}

export function startScheduler() {
  if (timer) return;
  const tick = async () => {
    try {
      await markOverdueInvoices();
      await sendDailyDigests();
      await sendAutoReminders();
    } catch (err) {
      console.error('[scheduler] tick failed', err.message);
    }
  };
  setTimeout(tick, 20_000);
  timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref?.();
}
