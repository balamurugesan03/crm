import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const ticketsApi = {
  ...createResourceApi('/tickets'),
  addNote: (id, body) => api.post(`/tickets/${id}/notes`, { body }).then((r) => r.data),
  reply: (id, body) => api.post(`/tickets/${id}/replies`, { body }).then((r) => r.data),
};
