import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const contactsApi = {
  ...createResourceApi('/contacts'),
  addNote: (id, body) => api.post(`/contacts/${id}/notes`, { body }).then((r) => r.data),
};
