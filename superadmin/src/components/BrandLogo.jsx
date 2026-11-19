import { useBranding } from '../branding/useBranding.js';

export function BrandLogo({ height = 32, onDark = false }) {
  const branding = useBranding();
  return (
    <img
      src={onDark ? branding.logoDarkUrl : branding.logoUrl}
      alt={branding.companyName || branding.appName}
      style={{ height, width: 'auto', maxWidth: 200, objectFit: 'contain', display: 'block' }}
    />
  );
}
