import CustomField from '../models/CustomField.js';
import { AppError } from '../utils/AppError.js';

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{5,19}$/;

function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Coerces one value to the field's type; throws AppError on invalid input.
function coerce(def, raw) {
  if (isEmpty(raw)) return null;
  const fail = (msg) => {
    throw new AppError(`${def.label}: ${msg}`, 422);
  };
  switch (def.type) {
    case 'number':
    case 'currency': {
      const n = Number(raw);
      if (!Number.isFinite(n)) fail('must be a number');
      return n;
    }
    case 'date': {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) fail('must be a valid date');
      return d.toISOString();
    }
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'select':
      if (!def.options.includes(String(raw))) fail('is not one of the allowed options');
      return String(raw);
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      if (arr.some((v) => !def.options.includes(v))) fail('contains an option that is not allowed');
      return arr;
    }
    case 'url':
      if (!URL_RE.test(String(raw))) fail('must be a URL starting with http(s)://');
      return String(raw).slice(0, 500);
    case 'email':
      if (!EMAIL_RE.test(String(raw))) fail('must be an email address');
      return String(raw).toLowerCase().slice(0, 200);
    case 'phone':
      if (!PHONE_RE.test(String(raw))) fail('must be a phone number');
      return String(raw);
    case 'textarea':
      return String(raw).slice(0, 5000);
    default:
      return String(raw).slice(0, 500);
  }
}

// Route middleware: validates req.body.customFields against the org's definitions for `entity`.
// Unknown keys are dropped. Required fields are enforced on create (and on update when sent).
export function validateCustomFields(entity) {
  return async (req, res, next) => {
    try {
      const isCreate = req.method === 'POST';
      const incoming = req.body?.customFields;
      if (!isCreate && incoming === undefined) return next();

      const defs = await CustomField.find({ organization: req.tenantId, entity });
      const input = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
      const clean = {};
      for (const def of defs) {
        const value = coerce(def, input[def.key]);
        if (def.required && (value === null || value === false && def.type !== 'checkbox')) {
          throw new AppError(`${def.label} is required`, 422);
        }
        if (value !== null) clean[def.key] = value;
      }
      req.body.customFields = clean;
      next();
    } catch (err) {
      next(err);
    }
  };
}
