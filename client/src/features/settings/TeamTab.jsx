import { useState } from 'react';
import { Paper, Group, Text, Button, Avatar, Select, Badge, Stack, Switch } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { usersApi } from '../../api/usersApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { AddTeamMemberDrawer } from './AddTeamMemberDrawer.jsx';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_rep', label: 'Sales rep' },
];

export function TeamTab() {
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const [drawerOpened, setDrawerOpened] = useState(false);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: usersApi.list });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => usersApi.updateTeamMember(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      notifications.show({ message: 'Team member updated', color: 'teal' });
    },
    onError: (err) => {
      notifications.show({ message: err?.response?.data?.message || 'Update failed', color: 'red' });
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text c="dimmed" size="sm">People with access to this workspace</Text>
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => setDrawerOpened(true)}>
            Add member
          </Button>
        )}
      </Group>

      <Paper p={0}>
        <Stack gap={0}>
          {members.map((member) => {
            const isSelf = member.id === currentUser?.id;
            const isOwner = member.role === 'owner';
            const locked = isSelf || isOwner || !canManage;

            return (
              <Group key={member.id} justify="space-between" p="md" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <Group>
                  <Avatar color={member.avatarColor} radius="xl">{member.name?.[0]}</Avatar>
                  <div>
                    <Group gap={6}>
                      <Text size="sm" fw={500}>{member.name}</Text>
                      {isSelf && <Badge size="xs" variant="light">You</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">{member.email}</Text>
                  </div>
                </Group>

                <Group gap="md">
                  {!member.isActive && <Badge color="gray" variant="light">Inactive</Badge>}
                  {isOwner ? (
                    <Badge variant="light" color="indigo" tt="capitalize">Owner</Badge>
                  ) : (
                    <Select
                      data={ROLE_OPTIONS}
                      value={member.role}
                      w={140}
                      size="xs"
                      allowDeselect={false}
                      disabled={locked}
                      onChange={(role) => updateMutation.mutate({ id: member.id, payload: { role } })}
                    />
                  )}
                  {!isOwner && (
                    <Switch
                      checked={member.isActive}
                      disabled={locked}
                      onChange={(e) =>
                        updateMutation.mutate({ id: member.id, payload: { isActive: e.currentTarget.checked } })
                      }
                      label="Active"
                      size="sm"
                    />
                  )}
                </Group>
              </Group>
            );
          })}
          {!isLoading && members.length === 0 && (
            <Text c="dimmed" size="sm" p="md">No team members yet.</Text>
          )}
        </Stack>
      </Paper>

      <AddTeamMemberDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} />
    </Stack>
  );
}
