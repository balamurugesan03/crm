import { api } from './axios.js';

export const searchApi = {
  search: (q) => api.get('/search', { params: { q } }).then((r) => r.data),
};
