import { api } from './axios.js';

export const organizationApi = {
  update: (payload) => api.patch('/organization', payload).then((r) => r.data),
};
