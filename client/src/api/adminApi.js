import { api } from './axios.js';

export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  listOrganizations: (params) => api.get('/admin/organizations', { params }).then((r) => r.data),
  getOrganization: (id) => api.get(`/admin/organizations/${id}`).then((r) => r.data),
  updateOrganization: (id, payload) => api.patch(`/admin/organizations/${id}`, payload).then((r) => r.data),
};
