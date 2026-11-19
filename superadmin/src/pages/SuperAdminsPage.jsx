import { useState } from 'react';
import { Paper, Stack, Group, Text, Badge, Button, Avatar, Menu, ActionIcon, TextInput, PasswordInput, Modal, Center, Loader } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconDotsVertical, IconUserOff, IconUserCheck, IconKey } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { PageHeader } from '../components/PageHeader.jsx';
import { FormDrawer } from '../components/FormDrawer.jsx';
import { confirmDelete } from '../components/confirmDelete.js';
import { adminApi, apiError } from '../api/adminApi.js';
import { useAuthStore } from '../store/authStore.js';

function CreateAdminDrawer({ opened, onClose }) {
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Name is required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });
  const mutation = useMutation({
    mutationFn: adminApi.createSuperAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-super-admins'] });
      notifications.show({ message: 'Super admin created', color: 'teal' });
      form.reset();
      onClose();
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not create super admin'), color: 'red' }),
  });
  return (
    <FormDrawer opened={opened} onClose={onClose} title="New super admin">
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <Text size="sm" c="dimmed">Core super admins have full platform control and no workspace of their own.</Text>
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput label="Email" required {...form.getInputProps('email')} />
          <PasswordInput label="Password" required {...form.getInputProps('password')} />
          <Button type="submit" loading={mutation.isPending}>Create super admin</Button>
        </Stack>
      </form>
    </FormDrawer>
  );
}

export function SuperAdminsPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const { data: admins, isLoading } = useQuery({ queryKey: ['admin-super-admins'], queryFn: adminApi.listSuperAdmins });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => adminApi.updateSuperAdmin(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-super-admins'] });
      notifications.show({ message: 'Super admin updated', color: 'teal' });
      setResetFor(null);
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Update failed'), color: 'red' }),
  });

  const pwForm = useForm({ initialValues: { password: '' }, validate: { password: (v) => (v.length >= 8 ? null : 'At least 8 characters') } });

  return (
    <>
      <PageHeader
        title="Super admins"
        subtitle="People with full control of the platform"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>New super admin</Button>}
      />

      {isLoading ? (
        <Center h={200}><Loader color="dark" /></Center>
      ) : (
        <Paper p="lg">
          <Stack gap={0}>
            {admins.map((a) => {
              const isMe = String(a.id) === String(me?.id);
              return (
                <Group key={a.id} justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
                  <Group gap={10}>
                    <Avatar radius="xl" color="dark">{a.name?.[0]?.toUpperCase()}</Avatar>
                    <div>
                      <Group gap={6}>
                        <Text size="sm" fw={600}>{a.name}</Text>
                        {isMe && <Badge size="xs" variant="light">You</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{a.email}</Text>
                    </div>
                  </Group>
                  <Group gap="sm">
                    <Text size="xs" c="dimmed">
                      {a.lastLoginAt ? `Last login ${dayjs(a.lastLoginAt).format('DD MMM YYYY')}` : 'Never logged in'}
                    </Text>
                    {a.organizationName ? (
                      <Badge variant="outline" color="gray" size="sm">Also in {a.organizationName}</Badge>
                    ) : (
                      <Badge variant="light" color="dark" size="sm">Core</Badge>
                    )}
                    {!a.isActive && <Badge color="red" variant="light" size="sm">Disabled</Badge>}
                    {!isMe && (
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconKey size={14} />} onClick={() => { pwForm.reset(); setResetFor(a); }}>
                            Reset password
                          </Menu.Item>
                          {a.isActive ? (
                            <Menu.Item
                              color="red"
                              leftSection={<IconUserOff size={14} />}
                              onClick={() =>
                                confirmDelete({
                                  title: `Disable ${a.name}?`,
                                  message: 'They will no longer be able to log in.',
                                  confirmLabel: 'Disable',
                                  onConfirm: () => updateMutation.mutate({ id: a.id, isActive: false }),
                                })
                              }
                            >
                              Disable
                            </Menu.Item>
                          ) : (
                            <Menu.Item leftSection={<IconUserCheck size={14} />} onClick={() => updateMutation.mutate({ id: a.id, isActive: true })}>
                              Enable
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}

      <CreateAdminDrawer opened={creating} onClose={() => setCreating(false)} />

      <Modal opened={Boolean(resetFor)} onClose={() => setResetFor(null)} title={<Text fw={650}>Reset password — {resetFor?.name}</Text>}>
        <form onSubmit={pwForm.onSubmit(({ password }) => updateMutation.mutate({ id: resetFor.id, password }))}>
          <Stack>
            <PasswordInput label="New password" data-autofocus {...pwForm.getInputProps('password')} />
            <Button type="submit" loading={updateMutation.isPending}>Set password</Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
