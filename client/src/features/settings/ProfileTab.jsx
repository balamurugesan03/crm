import { Paper, Stack, TextInput, PasswordInput, Button, Group, Text, Avatar, ColorSwatch, Divider, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';

import { usersApi } from '../../api/usersApi.js';
import { useAuthStore } from '../../store/authStore.js';

const AVATAR_COLORS = ['indigo', 'blue', 'teal', 'green', 'grape', 'pink', 'orange', 'red', 'gray'];

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);

  const profileForm = useForm({
    initialValues: { name: user?.name || '', avatarColor: user?.avatarColor || 'indigo' },
  });

  const profileMutation = useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: (updatedUser) => {
      setSession({ user: { ...user, ...updatedUser }, organization, accessToken });
      notifications.show({ message: 'Profile updated', color: 'teal' });
    },
  });

  const passwordForm = useForm({
    initialValues: { currentPassword: '', newPassword: '' },
    validate: {
      currentPassword: (v) => (v ? null : 'Required'),
      newPassword: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  const passwordMutation = useMutation({
    mutationFn: usersApi.changeMyPassword,
    onSuccess: () => {
      notifications.show({ message: 'Password changed', color: 'teal' });
      passwordForm.reset();
    },
  });

  return (
    <Stack gap="lg" maw={480}>
      <Paper p="lg">
        <form onSubmit={profileForm.onSubmit((values) => profileMutation.mutate(values))}>
          <Stack>
            <Group>
              <Avatar color={profileForm.values.avatarColor} radius="xl" size={48}>
                {profileForm.values.name?.[0]?.toUpperCase()}
              </Avatar>
              <TextInput label="Name" flex={1} {...profileForm.getInputProps('name')} />
            </Group>
            <div>
              <Text size="sm" fw={500} mb={6}>Avatar color</Text>
              <Group gap={8}>
                {AVATAR_COLORS.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={`var(--mantine-color-${color}-6)`}
                    size={24}
                    style={{ cursor: 'pointer', outline: profileForm.values.avatarColor === color ? '2px solid var(--mantine-color-dark-9)' : 'none', outlineOffset: 2 }}
                    onClick={() => profileForm.setFieldValue('avatarColor', color)}
                  />
                ))}
              </Group>
            </div>
            <TextInput label="Email" value={user?.email || ''} disabled />
            <Group justify="flex-end">
              <Button type="submit" loading={profileMutation.isPending}>Save changes</Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper p="lg">
        <Text fw={600} mb="md">Change password</Text>
        <form onSubmit={passwordForm.onSubmit((values) => passwordMutation.mutate(values))}>
          <Stack>
            {passwordMutation.isError && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {passwordMutation.error?.response?.data?.message || 'Could not change password'}
              </Alert>
            )}
            <PasswordInput label="Current password" {...passwordForm.getInputProps('currentPassword')} />
            <PasswordInput label="New password" {...passwordForm.getInputProps('newPassword')} />
            <Group justify="flex-end">
              <Button type="submit" loading={passwordMutation.isPending}>Update password</Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
