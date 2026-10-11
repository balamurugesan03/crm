import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { theme } from '../theme/theme.js';
import { AppRouter } from './router.jsx';
import { AuthBootstrap } from './AuthBootstrap.jsx';
import { BASE } from '../utils/paths.js';

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

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>
      <Notifications position="top-right" />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={BASE || undefined}>
            <AuthBootstrap>
              <AppRouter />
            </AuthBootstrap>
          </BrowserRouter>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
