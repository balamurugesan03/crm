import { Navigate, useLocation } from 'react-router-dom';
import { Center, Paper, Stack, Title, Text, Button, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';
import { useBranding } from '../branding/useBranding.js';

function WorkspaceLocked({ organization }) {
  const branding = useBranding();
  const clearSession = useAuthStore((s) => s.clearSession);
  return (
    <Center mih="100vh" p="md">
      <Paper p="xl" maw={440} shadow="md">
        <Stack align="center" ta="center" gap="sm">
          <ThemeIcon size={52} radius="xl" color="red" variant="light"><IconLock size={26} /></ThemeIcon>
          <Title order={3}>Subscription expired</Title>
          <Text c="dimmed" size="sm">
            The {organization?.name} workspace is locked because its subscription has ended. Your data is safe — contact{' '}
            {branding.supportEmail || branding.companyName || 'your provider'}
            {branding.supportPhone ? ` (${branding.supportPhone})` : ''} to renew.
          </Text>
          <Button variant="default" onClick={() => authApi.logout().catch(() => {}).finally(clearSession)}>Log out</Button>
        </Stack>
      </Paper>
    </Center>
  );
}

export function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Core super admins have no workspace of their own.
  if (user?.isSuperAdmin && !organization) {
    return <Navigate to="/admin" replace />;
  }
  if (!user?.isSuperAdmin && organization?.subscriptionStatus === 'expired') {
    return <WorkspaceLocked organization={organization} />;
  }
  return children;
}
