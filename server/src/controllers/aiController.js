import * as z from 'zod/v4';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { isAiConfigured } from '../ai/client.js';
import { generateInsights, draftMessage, naturalLanguageSearch, runCopilot } from '../ai/features.js';
import { isRestricted } from '../utils/visibility.js';

const ENTITY_TYPES = ['Deal', 'Contact', 'Company', 'Lead'];

const insightsBody = z.object({ entityType: z.enum(ENTITY_TYPES), entityId: z.string() });
const draftBody = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string(),
  channel: z.enum(['email', 'whatsapp']).default('email'),
  intent: z.string().max(500).optional(),
  tone: z.string().max(60).optional(),
  language: z.enum(['en', 'ta', 'tanglish', 'hi']).default('en'),
});
const searchBody = z.object({ query: z.string().trim().min(2).max(300) });
const chatBody = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).max(40).default([]),
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError('Invalid request', 400, result.error.issues);
  return result.data;
}

export const getAiStatus = (req, res) => {
  res.json({ configured: isAiConfigured(), model: isAiConfigured() ? env.aiModel : null });
};

export const getInsights = catchAsync(async (req, res) => {
  const { entityType, entityId } = parse(insightsBody, req.body);
  res.json(await generateInsights(req.tenantId, entityType, entityId, { restrictToUser: isRestricted(req) ? req.user._id : null }));
});

export const getDraft = catchAsync(async (req, res) => {
  res.json(await draftMessage(req.tenantId, req.user, parse(draftBody, req.body), { restrictToUser: isRestricted(req) ? req.user._id : null }));
});

export const search = catchAsync(async (req, res) => {
  const { query } = parse(searchBody, req.body);
  res.json(await naturalLanguageSearch(req.tenantId, req.user, query, { restricted: isRestricted(req) }));
});

// Server-Sent Events stream: `data: {"type":"text"|"tool"|"done"|"error", ...}\n\n`
export const chat = catchAsync(async (req, res) => {
  const { message, history } = parse(chatBody, req.body);
  if (!isAiConfigured()) throw new AppError('AI is not configured. Add ANTHROPIC_API_KEY to server/.env.', 503);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    await runCopilot(req.tenantId, req.user, history, message, send, controller.signal, { restricted: isRestricted(req) });
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message || 'AI request failed' });
  } finally {
    res.end();
  }
});
