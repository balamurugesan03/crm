import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const quotesApi = {
  ...createResourceApi('/quotes'),
  convertToInvoice: (id) => api.post(`/quotes/${id}/convert-to-invoice`).then((r) => r.data),
};
