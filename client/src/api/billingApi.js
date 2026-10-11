import { api } from './axios.js';

export const billingApi = {
  getPlans: () => api.get('/billing/plans').then((r) => r.data),
  createCheckoutSession: (plan) => api.post('/billing/checkout-session', { plan }).then((r) => r.data),
  createPortalSession: () => api.post('/billing/portal-session').then((r) => r.data),
};
