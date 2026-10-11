import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Anchor, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { IconAlertCircle } from '@tabler/icons-react';

import { AuthLayout } from './AuthLayout.jsx';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export function LoginPage() {
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
      navigate(location.state?.from?.pathname || '/', { replace: true });
    },
  });

  return (
    <AuthLayout>
      <Stack gap={4} mb="lg">
        <Title order={2}>Welcome back</Title>
        <Text c="dimmed" size="sm">Log in to your workspace</Text>
      </Stack>

      <Paper p="xl" shadow="md">
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack>
            {mutation.isError && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {mutation.error?.response?.data?.message || 'Login failed'}
              </Alert>
            )}
            <TextInput label="Email" placeholder="you@company.com" {...form.getInputProps('email')} />
            <PasswordInput label="Password" placeholder="Your password" {...form.getInputProps('password')} />
            <Button type="submit" fullWidth loading={mutation.isPending} size="md">
              Log in
            </Button>
            {import.meta.env.DEV && (
              <Button
                variant="light"
                fullWidth
                type="button"
                onClick={() => mutation.mutate({ email: 'demo@nexuscrm.io', password: 'Demo@1234' })}
              >
                Explore the demo workspace
              </Button>
            )}
          </Stack>
        </form>
      </Paper>

      <Text size="sm" c="dimmed" ta="center" mt="md">
        Don't have a workspace?{' '}
        <Anchor component={Link} to="/signup">Create one</Anchor>
      </Text>
    </AuthLayout>
  );
}
