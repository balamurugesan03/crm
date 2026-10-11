import { api } from './axios.js';

export const pipelineStagesApi = {
  list: () => api.get('/pipeline-stages').then((r) => r.data),
  create: (payload) => api.post('/pipeline-stages', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/pipeline-stages/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/pipeline-stages/${id}`).then((r) => r.data),
};
