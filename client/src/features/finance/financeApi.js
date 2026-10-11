import { api } from '../../api/axios.js';

export const PAYMENT_MODES = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer (NEFT/RTGS/IMPS)' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];
export const MODE_LABEL = Object.fromEntries(PAYMENT_MODES.map((m) => [m.value, m.label.split(' (')[0]]));

export const INVOICE_STATUS = {
  draft: { color: 'gray', label: 'Draft' },
  sent: { color: 'blue', label: 'Sent' },
  partially_paid: { color: 'yellow', label: 'Part paid' },
  paid: { color: 'teal', label: 'Paid' },
  overdue: { color: 'red', label: 'Overdue' },
  void: { color: 'gray', label: 'Void' },
};

export const financeApi = {
  receivables: () => api.get('/finance/receivables').then((r) => r.data),
  payments: (params) => api.get('/finance/payments', { params }).then((r) => r.data),
  invoicePayments: (id) => api.get(`/finance/invoices/${id}/payments`).then((r) => r.data),
  recordPayment: (id, payload) => api.post(`/finance/invoices/${id}/payments`, payload).then((r) => r.data),
  deletePayment: (id) => api.delete(`/finance/payments/${id}`).then((r) => r.data),
  remind: (id, channel) => api.post(`/finance/invoices/${id}/remind`, { channel }).then((r) => r.data),
  gstr1: (period) => api.get('/finance/gstr1', { params: { period } }).then((r) => r.data),
  gstr1Csv: async (period, section) => {
    const res = await api.get('/finance/gstr1', { params: { period, section, format: 'csv' }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1-${period}-${section}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};
