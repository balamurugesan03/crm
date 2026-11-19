import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE, appPath } from '../utils/paths.js';

// Built-in look, used until the super admin changes it in /admin/branding.
export const DEFAULT_BRANDING = {
  appName: 'Unizova CRM',
  companyName: 'Unizova Technologies',
  tagline: 'Sales, support and marketing — one fast, beautiful workspace.',
  primaryColor: '',
  supportEmail: '',
  supportPhone: '',
  allowPublicSignup: false,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
};

// Asset URLs come back API-relative ('/public/branding/logo?v=..').
const toAbsolute = (u) => (u ? `${API_BASE}${u}` : null);

export const brandingQuery = {
  queryKey: ['branding'],
  queryFn: () => axios.get(`${API_BASE}/public/branding`).then((r) => r.data),
  staleTime: 5 * 60_000,
  retry: 1,
};

export function useBranding() {
  const { data } = useQuery(brandingQuery);
  const b = { ...DEFAULT_BRANDING, ...(data || {}) };
  return {
    ...b,
    logoUrl: toAbsolute(b.logoUrl) || appPath('/unizova-logo.jpeg'),
    // A custom light logo is reused on dark surfaces when no dark variant was uploaded.
    logoDarkUrl: toAbsolute(b.logoDarkUrl) || toAbsolute(b.logoUrl) || appPath('/unilogo-dark.png'),
    faviconUrl: toAbsolute(b.faviconUrl) || appPath('/favicon.png'),
    loaded: Boolean(data),
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix([r, g, b], [r2, g2, b2], t) {
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r, r2)}${c(g, g2)}${c(b, b2)}`;
}

// 10-step Mantine palette with the chosen colour at index 6 (the app's primary shade).
export function paletteFromHex(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  const base = hexToRgb(hex);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  return [
    mix(base, white, 0.92),
    mix(base, white, 0.82),
    mix(base, white, 0.64),
    mix(base, white, 0.46),
    mix(base, white, 0.28),
    mix(base, white, 0.12),
    hex.toLowerCase(),
    mix(base, black, 0.14),
    mix(base, black, 0.26),
    mix(base, black, 0.4),
  ];
}
