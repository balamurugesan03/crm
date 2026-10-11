import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const automationsApi = {
  ...createResourceApi('/automations'),
  meta: () => api.get('/automations/meta').then((r) => r.data),
};
