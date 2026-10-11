import { api } from './axios.js';

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  addTeamMember: (payload) => api.post('/users', payload).then((r) => r.data),
  updateTeamMember: (id, payload) => api.patch(`/users/${id}`, payload).then((r) => r.data),
  updateMe: (payload) => api.patch('/users/me', payload).then((r) => r.data),
  changeMyPassword: (payload) => api.post('/users/me/change-password', payload).then((r) => r.data),
};
