import { useEffect } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';

export function AuthBootstrap({ children }) {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        useAuthStore.getState().setAccessToken(accessToken);
        const { user, organization } = await authApi.me();
        if (!cancelled) setSession({ user, organization, accessToken });
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <Center h="100vh">
        <Loader color="indigo" />
      </Center>
    );
  }

  return children;
}
