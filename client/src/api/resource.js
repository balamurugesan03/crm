import { api } from './axios.js';

export function createResourceApi(basePath) {
  return {
    list: (params) => api.get(basePath, { params }).then((r) => r.data),
    get: (id) => api.get(`${basePath}/${id}`).then((r) => r.data),
    create: (payload) => api.post(basePath, payload).then((r) => r.data),
    update: (id, payload) => api.patch(`${basePath}/${id}`, payload).then((r) => r.data),
    remove: (id) => api.delete(`${basePath}/${id}`).then((r) => r.data),
  };
}
