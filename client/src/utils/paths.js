// The app can be served from a sub-path (e.g. https://unizova.com/crm). Vite exposes it as BASE_URL
// ('/' in dev, '/crm/' in the production build — see client/.env.production).
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/crm'

// In-app path including the base, for raw <a href> / window.open (React Router links add it themselves).
export const appPath = (p) => `${BASE}${p}`;

export const API_BASE = appPath('/api');

// Absolute URL to share outside the app (embed codes, public links).
export const absoluteUrl = (p) => `${window.location.origin}${appPath(p)}`;
