import { useEffect } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';

// Restores a super admin session from the admin refresh cookie on page load.
export function AuthBootstrap({ children }) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = useAuthStore.getState();
      try {
        const { accessToken } = await authApi.refresh();
        store.setAccessToken(accessToken);
        const { user, organization } = await authApi.me();
        if (cancelled) return;
        if (user?.isSuperAdmin) store.setSession({ user, organization, accessToken });
        else store.clearSession();
      } catch {
        if (!cancelled) store.clearSession();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return <Center h="100vh"><Loader color="dark" /></Center>;
  }
  return children;
}
