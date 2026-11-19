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
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

const colorSchemeManager = localStorageColorSchemeManager({ key: 'nexuscrm-admin-color-scheme' });

// Follows the platform branding (primary colour + favicon), like the workspace app.
function BrandedMantine({ children }) {
  const branding = useBranding();
  const palette = paletteFromHex(branding.primaryColor);

  const brandedTheme = useMemo(
    () => (palette ? { ...theme, colors: { ...theme.colors, indigo: palette } } : theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branding.primaryColor],
  );

  useEffect(() => {
    document.title = `${branding.appName} · Super Admin`;
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = branding.faviconUrl;
  }, [branding.appName, branding.faviconUrl]);

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
