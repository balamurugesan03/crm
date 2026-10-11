import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, Stack, Title, Text, Paper, Anchor, Center, Loader, Badge, Select, Button, Avatar, ThemeIcon } from '@mantine/core';
import { IconArrowLeft, IconBuildingSkyscraper, IconLockPause, IconLockOpen } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { adminApi } from '../../api/adminApi.js';
import { confirmDelete } from '../../components/confirmDelete.js';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];
const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
];

export function OrganizationDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ['admin-organizations', id],
    queryFn: () => adminApi.getOrganization(id),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => adminApi.updateOrganization(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      notifications.show({ message: 'Organization updated', color: 'teal' });
    },
  });

  if (isLoading || !org) {
    return (
      <Center h={300}>
        <Loader color="dark" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/admin/organizations" size="sm" c="dimmed">
        <Group gap={4}><IconArrowLeft size={14} /> Back to organizations</Group>
      </Anchor>

      <Paper p="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <ThemeIcon size={48} radius="xl" variant="light" color="dark">
              <IconBuildingSkyscraper size={22} />
            </ThemeIcon>
            <div>
              <Group gap={8}>
                <Title order={3}>{org.name}</Title>
                {org.isSuspended && <Badge color="red" variant="filled">Suspended</Badge>}
              </Group>
              <Text c="dimmed" size="sm">/{org.slug} · Joined {dayjs(org.createdAt).format('DD MMM YYYY')}</Text>
              <Text size="sm" mt={4}>Revenue: {formatCurrency(org.revenue)}</Text>
            </div>
          </Group>

          {org.isSuspended ? (
            <Button
              color="teal"
              variant="light"
              leftSection={<IconLockOpen size={14} />}
              onClick={() => updateMutation.mutate({ isSuspended: false })}
            >
              Reactivate
            </Button>
          ) : (
            <Button
              color="orange"
              variant="light"
              leftSection={<IconLockPause size={14} />}
              onClick={() =>
                confirmDelete({
                  title: 'Suspend this organization?',
                  message: `Users in "${org.name}" will be unable to log in until reactivated.`,
                  confirmLabel: 'Suspend',
                  confirmColor: 'orange',
                  onConfirm: () => updateMutation.mutate({ isSuspended: true }),
                })
              }
            >
              Suspend
            </Button>
          )}
        </Group>

        <Group grow mt="lg" maw={400}>
          <Select
            label="Plan"
            data={PLAN_OPTIONS}
            value={org.plan}
            allowDeselect={false}
            onChange={(plan) => updateMutation.mutate({ plan })}
          />
          <Select
            label="Subscription status"
            data={STATUS_OPTIONS}
            value={org.subscriptionStatus}
            allowDeselect={false}
            onChange={(subscriptionStatus) => updateMutation.mutate({ subscriptionStatus })}
          />
        </Group>
      </Paper>

      <Paper p="lg">
        <Title order={4} mb="md">Users ({org.users.length})</Title>
        <Stack gap={0}>
          {org.users.map((u) => (
            <Group key={u.id} justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
              <Group gap={8}>
                <Avatar size={28} radius="xl" color={u.avatarColor}>{u.name?.[0]}</Avatar>
                <div>
                  <Text size="sm" fw={500}>{u.name}</Text>
                  <Text size="xs" c="dimmed">{u.email}</Text>
                </div>
              </Group>
              <Group gap="sm">
                {!u.isActive && <Badge color="gray" variant="light" size="sm">Inactive</Badge>}
                <Badge variant="light" tt="capitalize" size="sm">{u.role.replace('_', ' ')}</Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
