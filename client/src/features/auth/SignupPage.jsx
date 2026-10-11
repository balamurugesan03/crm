import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Anchor, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { IconAlertCircle } from '@tabler/icons-react';

import { AuthLayout } from './AuthLayout.jsx';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';

export function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const form = useForm({
    initialValues: { organizationName: '', name: '', email: '', password: '' },
    validate: {
      organizationName: (v) => (v.trim().length >= 2 ? null : 'Organization name is required'),
      name: (v) => (v.trim().length >= 2 ? null : 'Your name is required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  const mutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (data) => {
      setSession(data);
      navigate('/', { replace: true });
    },
  });

  return (
    <AuthLayout>
      <Stack gap={4} mb="lg">
        <Title order={2}>Create your workspace</Title>
        <Text c="dimmed" size="sm">Start your free trial — no credit card required</Text>
      </Stack>

      <Paper p="xl" shadow="md">
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack>
            {mutation.isError && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {mutation.error?.response?.data?.message || 'Signup failed'}
              </Alert>
            )}
            <TextInput label="Organization name" placeholder="Acme Inc." {...form.getInputProps('organizationName')} />
            <TextInput label="Your name" placeholder="Jane Doe" {...form.getInputProps('name')} />
            <TextInput label="Email" placeholder="you@company.com" {...form.getInputProps('email')} />
            <PasswordInput label="Password" placeholder="At least 8 characters" {...form.getInputProps('password')} />
            <Button type="submit" fullWidth loading={mutation.isPending}>
              Create workspace
            </Button>
          </Stack>
        </form>
      </Paper>

      <Text size="sm" c="dimmed" ta="center" mt="md">
        Already have a workspace?{' '}
        <Anchor component={Link} to="/login">Log in</Anchor>
      </Text>
    </AuthLayout>
  );
}
