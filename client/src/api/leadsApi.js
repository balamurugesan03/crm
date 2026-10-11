import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const leadsApi = {
  ...createResourceApi('/leads'),
  convert: (id) => api.post(`/leads/${id}/convert`).then((r) => r.data),
};
