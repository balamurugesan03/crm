import { api } from './axios.js';

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary').then((r) => r.data),
};
