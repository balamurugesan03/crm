import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const companiesApi = {
  ...createResourceApi('/companies'),
  addNote: (id, body) => api.post(`/companies/${id}/notes`, { body }).then((r) => r.data),
};
