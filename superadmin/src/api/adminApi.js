import { api } from './axios.js';

export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),

  listOrganizations: (params) => api.get('/admin/organizations', { params }).then((r) => r.data),
  getOrganization: (id) => api.get(`/admin/organizations/${id}`).then((r) => r.data),
  createOrganization: (payload) => api.post('/admin/organizations', payload).then((r) => r.data),
  updateOrganization: (id, payload) => api.patch(`/admin/organizations/${id}`, payload).then((r) => r.data),
  resetUserPassword: (id, payload) => api.post(`/admin/organizations/${id}/reset-password`, payload).then((r) => r.data),
  recordSettlement: (id, payload) => api.post(`/admin/organizations/${id}/settlements`, payload).then((r) => r.data),
  deleteSettlement: (id, settlementId) => api.delete(`/admin/organizations/${id}/settlements/${settlementId}`).then((r) => r.data),

  listSettlements: (params) => api.get('/admin/settlements', { params }).then((r) => r.data),

  listPlans: () => api.get('/admin/plans').then((r) => r.data),
  createPlan: (payload) => api.post('/admin/plans', payload).then((r) => r.data),
  updatePlan: (id, payload) => api.patch(`/admin/plans/${id}`, payload).then((r) => r.data),
  deletePlan: (id) => api.delete(`/admin/plans/${id}`).then((r) => r.data),

  getPlatformSettings: () => api.get('/admin/platform-settings').then((r) => r.data),
  updatePlatformSettings: (payload) => api.put('/admin/platform-settings', payload).then((r) => r.data),

  listSuperAdmins: () => api.get('/admin/super-admins').then((r) => r.data),
  createSuperAdmin: (payload) => api.post('/admin/super-admins', payload).then((r) => r.data),
  updateSuperAdmin: (id, payload) => api.patch(`/admin/super-admins/${id}`, payload).then((r) => r.data),
};

export const BILLING_CYCLE_LABELS = {
  free: 'Free / trial',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-time (lifetime)',
};

export const PAYMENT_MODE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const STATUS_COLORS = { trialing: 'blue', active: 'teal', past_due: 'orange', canceled: 'red', expired: 'red' };

export function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || fallback;
}
