import { useEffect, useMemo } from 'react';
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { theme } from '../theme/theme.js';
import { AppRouter } from './router.jsx';
import { AuthBootstrap } from './AuthBootstrap.jsx';
import { BASE } from '../utils/paths.js';
import { useBranding, paletteFromHex } from '../branding/useBranding.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const colorSchemeManager = localStorageColorSchemeManager({ key: 'nexuscrm-color-scheme' });

// Applies the super admin's branding: the primary colour replaces the built-in indigo palette
// (so every indigo accent follows it), and the tab title / favicon follow the app name and icon.
function BrandedMantine({ children }) {
  const branding = useBranding();
  const palette = paletteFromHex(branding.primaryColor);

  const brandedTheme = useMemo(
    () => (palette ? { ...theme, colors: { ...theme.colors, indigo: palette } } : theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branding.primaryColor],
  );

  useEffect(() => {
    document.title = branding.appName;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', branding.appName);
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = branding.faviconUrl;
  }, [branding.appName, branding.faviconUrl]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (palette) {
      root.setProperty('--brand-gradient', `linear-gradient(135deg, ${palette[5]} 0%, ${palette[7]} 100%)`);
      root.setProperty('--brand-glow', palette[5]);
    } else {
      root.removeProperty('--brand-gradient');
      root.removeProperty('--brand-glow');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.primaryColor]);

  return (
    <MantineProvider theme={brandedTheme} defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>
      {children}
    </MantineProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandedMantine>
        <Notifications position="top-right" />
        <ModalsProvider>
          <BrowserRouter basename={BASE || undefined}>
            <AuthBootstrap>
              <AppRouter />
            </AuthBootstrap>
          </BrowserRouter>
        </ModalsProvider>
      </BrandedMantine>
    </QueryClientProvider>
  );
}
