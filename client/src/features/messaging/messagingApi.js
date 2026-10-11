import { api } from '../../api/axios.js';

export const messagingApi = {
  channels: () => api.get('/messages/channels').then((r) => r.data),
  list: (entityType, entityId) => api.get('/messages', { params: { entityType, entityId } }).then((r) => r.data),
  send: (payload) => api.post('/messages/send', payload).then((r) => r.data),
  preview: (payload) => api.post('/messages/preview', payload).then((r) => r.data),
  test: (channel) => api.post(`/messages/test/${channel}`).then((r) => r.data),
  templates: (channel) => api.get('/messages/templates', { params: channel ? { channel } : {} }).then((r) => r.data),
  createTemplate: (p) => api.post('/messages/templates', p).then((r) => r.data),
  updateTemplate: (id, p) => api.patch(`/messages/templates/${id}`, p).then((r) => r.data),
  removeTemplate: (id) => api.delete(`/messages/templates/${id}`).then((r) => r.data),
};

export function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d;
}
