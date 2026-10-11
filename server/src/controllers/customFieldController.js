import * as z from 'zod/v4';
import CustomField, { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES } from '../models/CustomField.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

const MAX_PER_ENTITY = 30;

const fieldSchema = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  label: z.string().trim().min(1).max(60),
  type: z.enum(CUSTOM_FIELD_TYPES).default('text'),
  options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  required: z.boolean().default(false),
  helpText: z.string().trim().max(200).optional(),
  order: z.number().int().min(0).max(1000).optional(),
  showInList: z.boolean().optional(),
});

function slugKey(label) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 36) || 'field';
  return /^[a-z]/.test(base) ? base : `f_${base}`;
}

function validate(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError('Validation failed', 422, r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  const data = r.data;
  if (['select', 'multiselect'].includes(data.type) && data.options !== undefined && data.options.length === 0) {
    throw new AppError('Choice fields need at least one option', 422);
  }
  return data;
}

export const listCustomFields = catchAsync(async (req, res) => {
  const filter = { organization: req.tenantId };
  if (req.query.entity) filter.entity = req.query.entity;
  res.json(await CustomField.find(filter).sort({ entity: 1, order: 1, createdAt: 1 }));
});

export const createCustomField = catchAsync(async (req, res) => {
  const data = validate(fieldSchema, req.body);
  const count = await CustomField.countDocuments({ organization: req.tenantId, entity: data.entity });
  if (count >= MAX_PER_ENTITY) throw new AppError(`Up to ${MAX_PER_ENTITY} custom fields per record type`, 400);

  let key = slugKey(data.label);
  for (let i = 2; await CustomField.exists({ organization: req.tenantId, entity: data.entity, key }); i += 1) {
    key = `${slugKey(data.label).slice(0, 36)}_${i}`;
  }
  const field = await CustomField.create({ ...data, key, order: data.order ?? count, organization: req.tenantId });
  res.status(201).json(field);
});

export const updateCustomField = catchAsync(async (req, res) => {
  // entity, key and type are fixed once created so stored values stay meaningful.
  const data = validate(fieldSchema.omit({ entity: true, type: true }).partial(), req.body);
  const field = await CustomField.findOne({ _id: req.params.id, organization: req.tenantId });
  if (!field) throw new AppError('Field not found', 404);
  if (['select', 'multiselect'].includes(field.type) && data.options && data.options.length === 0) {
    throw new AppError('Choice fields need at least one option', 422);
  }
  Object.assign(field, data);
  await field.save();
  res.json(field);
});

export const deleteCustomField = catchAsync(async (req, res) => {
  const field = await CustomField.findOneAndDelete({ _id: req.params.id, organization: req.tenantId });
  if (!field) throw new AppError('Field not found', 404);
  res.status(204).send();
});
