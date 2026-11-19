// The console can be served from a sub-path (e.g. https://unizova.com/crm/admin/).
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/crm/admin'

// In-app path including the base, for raw <a href> / <img src>.
export const appPath = (p) => `${BASE}${p}`;

// The API is shared with the workspace app, so it is configured separately from BASE.
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

// Where the workspace CRM lives (for "Back to my workspace").
export const WORKSPACE_URL = import.meta.env.VITE_WORKSPACE_URL || '/';
