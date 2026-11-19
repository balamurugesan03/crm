import { api } from './axios.js';

// Super admin authentication — separate endpoints and session cookie from the workspace app.
export const authApi = {
  login: (payload) => api.post('/auth/admin/login', payload).then((r) => r.data),
  logout: () => api.post('/auth/admin/logout').then((r) => r.data),
  refresh: () => api.post('/auth/admin/refresh').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};
