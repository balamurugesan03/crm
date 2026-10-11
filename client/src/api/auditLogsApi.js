import { api } from './axios.js';

export const auditLogsApi = {
  list: (params) => api.get('/audit-logs', { params }).then((r) => r.data),
};
