import axios from 'axios';
import { api } from './axios.js';
import { useAuthStore } from '../store/authStore.js';
import { API_BASE } from '../utils/paths.js';

async function refreshToken() {
  const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
  useAuthStore.getState().setAccessToken(data.accessToken);
  return data.accessToken;
}

async function postStream(path, body, signal) {
  const doFetch = (token) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });
  let res = await doFetch(useAuthStore.getState().accessToken);
  if (res.status === 401) res = await doFetch(await refreshToken());
  return res;
}

export const aiApi = {
  status: () => api.get('/ai/status').then((r) => r.data),
  insights: (entityType, entityId) => api.post('/ai/insights', { entityType, entityId }).then((r) => r.data),
  draft: (payload) => api.post('/ai/draft', payload).then((r) => r.data),
  search: (query) => api.post('/ai/search', { query }).then((r) => r.data),

  // Streams the Copilot reply over SSE. Calls onEvent({type:'text'|'tool'|'done'|'error', ...}).
  chat: async ({ message, history, onEvent, signal }) => {
    const res = await postStream('/ai/chat', { message, history }, signal);
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      onEvent({ type: 'error', message: err.message || `Request failed (${res.status})` });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop();
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          // ignore malformed frame
        }
      }
    }
  },
};
