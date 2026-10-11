import { Stack, TextInput, PasswordInput, Select, Button, Group, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { usersApi } from '../../api/usersApi.js';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_rep', label: 'Sales rep' },
];

export function AddTeamMemberDrawer({ opened, onClose }) {
  const queryClient = useQueryClient();

  const form = useForm({
    initialValues: { name: '', email: '', password: '', role: 'sales_rep' },
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Name is required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  const mutation = useMutation({
    mutationFn: usersApi.addTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      notifications.show({ message: 'Team member added', color: 'teal' });
      form.reset();
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title="Add team member">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          {mutation.isError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {mutation.error?.response?.data?.message || 'Could not add team member'}
            </Alert>
          )}
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput label="Email" type="email" required {...form.getInputProps('email')} />
          <PasswordInput label="Temporary password" required {...form.getInputProps('password')} />
          <Select label="Role" data={ROLE_OPTIONS} allowDeselect={false} {...form.getInputProps('role')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Add member</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
