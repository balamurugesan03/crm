import { Center, Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Alert, Group, ThemeIcon, Anchor } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconAlertCircle, IconShieldLock } from '@tabler/icons-react';

import { BrandLogo } from '../components/BrandLogo.jsx';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/authApi.js';
import { WORKSPACE_URL } from '../utils/paths.js';

// Dedicated sign-in for platform super admins (/admin/login). Workspace users sign in at /login.
export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length > 0 ? null : 'Password is required'),
    },
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setSession(data);
      const from = location.state?.from?.pathname;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    },
  });

  return (
    <Center mih="100vh" p="md" style={{ background: '#0f1222' }}>
      <Stack w="100%" maw={420}>
        <Stack align="center" gap={6} mb="sm">
          <BrandLogo height={30} />
          <Group gap={6} c="gray.3">
            <ThemeIcon size="sm" radius="xl" color="dark" variant="filled"><IconShieldLock size={12} /></ThemeIcon>
            <Text fw={700} size="sm">Super Admin Console</Text>
          </Group>
        </Stack>

        <Paper p="xl" shadow="md" radius="md">
          <Stack gap={4} mb="lg">
            <Title order={3}>Super admin sign in</Title>
            <Text c="dimmed" size="sm">Restricted to platform administrators</Text>
          </Stack>
          <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
            <Stack>
              {mutation.isError && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  {mutation.error?.response?.data?.message || 'Login failed'}
                </Alert>
              )}
              <TextInput label="Email" placeholder="superadmin@company.com" autoComplete="username" {...form.getInputProps('email')} />
              <PasswordInput label="Password" placeholder="Your password" autoComplete="current-password" {...form.getInputProps('password')} />
              <Button type="submit" fullWidth loading={mutation.isPending} size="md" color="dark">
                Sign in to admin
              </Button>
            </Stack>
          </form>
        </Paper>

        <Text size="sm" c="gray.5" ta="center">
          Workspace user? <Anchor href={WORKSPACE_URL} c="gray.3">Go to workspace login</Anchor>
        </Text>
      </Stack>
    </Center>
  );
}
