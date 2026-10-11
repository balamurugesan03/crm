import { createResourceApi } from './resource.js';
import { api } from './axios.js';

export const invoicesApi = {
  ...createResourceApi('/invoices'),
  markPaid: (id) => api.post(`/invoices/${id}/mark-paid`).then((r) => r.data),
};
