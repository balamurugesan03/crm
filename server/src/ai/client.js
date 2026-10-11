import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let client = null;

export function isAiConfigured() {
  return Boolean(env.anthropicApiKey);
}

export function getClient() {
  if (!isAiConfigured()) {
    throw new AppError('AI is not configured. Add ANTHROPIC_API_KEY to server/.env and restart the server.', 503);
  }
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

// Shared request fields: the configured model plus server-side refusal fallbacks,
// which re-run a declined request on Anthropic's recommended fallback model instead of failing.
export function baseParams() {
  return {
    model: env.aiModel,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

// Maps SDK errors to user-facing AppErrors without leaking provider details.
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AppError('AI key is invalid. Check ANTHROPIC_API_KEY.', 503);
  if (err instanceof Anthropic.RateLimitError) return new AppError('AI is busy right now. Please retry in a minute.', 429);
  if (err instanceof Anthropic.BadRequestError) {
    console.error('[ai] bad request', err.message);
    return new AppError('AI request was rejected.', 502);
  }
  if (err instanceof Anthropic.APIError) {
    console.error('[ai] api error', err.status, err.message);
    return new AppError('AI service error. Please retry.', 502);
  }
  if (err instanceof Anthropic.APIConnectionError) return new AppError('Could not reach the AI service.', 502);
  console.error('[ai] unexpected', err);
  return new AppError('AI request failed.', 500);
}

// One structured-output call: returns the Zod-validated object.
export async function structuredCall({ system, prompt, schema, effort = 'low', maxTokens = 8000 }) {
  try {
    const response = await getClient().beta.messages.parse({
      ...baseParams(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === 'refusal') {
      throw new AppError('The AI declined to answer this request.', 422);
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new AppError('The AI response was incomplete. Please retry.', 502);
    }
    return response.parsed_output;
  } catch (err) {
    throw toAppError(err);
  }
}
