import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const dealsApi = {
  ...createResourceApi('/deals'),
  addNote: (id, body) => api.post(`/deals/${id}/notes`, { body }).then((r) => r.data),
};
