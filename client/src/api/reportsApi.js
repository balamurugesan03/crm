import { api } from './axios.js';

export const reportsApi = {
  get: () => api.get('/reports').then((r) => r.data),
};
