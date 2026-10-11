import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const eventsApi = {
  ...createResourceApi('/events'),
  upcoming: (params) => api.get('/events/upcoming', { params }).then((r) => r.data),
};
