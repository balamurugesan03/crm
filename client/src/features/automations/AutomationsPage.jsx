import { useState } from 'react';
import {
  Button, SimpleGrid, Paper, Group, Text, Switch, Badge, ActionIcon, Menu, Stack, ThemeIcon, Skeleton, Alert,
} from '@mantine/core';
import {
  IconPlus, IconBolt, IconDotsVertical, IconPencil, IconTrash, IconArrowRight, IconInfoCircle,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

import { PageHeader } from '../../components/PageHeader.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { automationsApi } from '../../api/automationsApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { AutomationFormDrawer } from './AutomationFormDrawer.jsx';
import { TRIGGER_LABEL, ACTION_LABEL, OPERATORS, FIELDS_BY_ENTITY, entityOf } from './automationMeta.js';

dayjs.extend(relativeTime);

const OPERATOR_LABEL = Object.fromEntries(OPERATORS.map((o) => [o.value, o.label]));
const MANAGER_ROLES = ['owner', 'admin', 'manager'];

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = MANAGER_ROLES.includes(role);
  const [drawer, setDrawer] = useState({ opened: false, automation: null });

  const { data: items = [], isLoading } = useQuery({ queryKey: ['automations'], queryFn: () => automationsApi.list() });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => automationsApi.update(id, { isActive }),
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      notifications.show({ message: `${a.name} ${a.isActive ? 'enabled' : 'paused'}`, color: a.isActive ? 'teal' : 'gray' });
    },
  });

  const remove = useMutation({
    mutationFn: automationsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  const activeCount = items.filter((a) => a.isActive).length;
  const totalRuns = items.reduce((s, a) => s + (a.runCount || 0), 0);

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Let NexusCRM do the busywork — trigger tasks, alerts and updates automatically"
        action={
          canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setDrawer({ opened: true, automation: null })}>
              New automation
            </Button>
          )
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Paper p="md"><Text size="xs" c="dimmed" fw={600} tt="uppercase">Workflows</Text><Text fz={24} fw={750}>{items.length}</Text></Paper>
        <Paper p="md"><Text size="xs" c="dimmed" fw={600} tt="uppercase">Active</Text><Text fz={24} fw={750} c="teal">{activeCount}</Text></Paper>
        <Paper p="md"><Text size="xs" c="dimmed" fw={600} tt="uppercase">Total runs</Text><Text fz={24} fw={750}>{totalRuns.toLocaleString('en-IN')}</Text></Paper>
      </SimpleGrid>

      {!canManage && (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" mb="md">Only owners, admins and managers can change automations.</Alert>
      )}

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, md: 2 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={170} radius="lg" />)}</SimpleGrid>
      ) : items.length === 0 ? (
        <Paper>
          <EmptyState
            icon={IconBolt}
            title="No automations yet"
            description="Create your first workflow — for example, auto-assign a follow-up task when a high-value lead comes in."
            actionLabel={canManage ? 'Create automation' : undefined}
            onAction={() => setDrawer({ opened: true, automation: null })}
          />
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {items.map((a) => (
            <Paper key={a._id} p="lg" shadow="xs" className="hover-lift" style={{ opacity: a.isActive ? 1 : 0.7 }}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon size={40} radius="md" variant={a.isActive ? 'gradient' : 'light'} gradient={{ from: 'indigo', to: 'violet', deg: 135 }} color="gray">
                    <IconBolt size={20} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} truncate>{a.name}</Text>
                    {a.description && <Text size="xs" c="dimmed" lineClamp={1}>{a.description}</Text>}
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Switch
                    checked={a.isActive}
                    disabled={!canManage}
                    onChange={(e) => toggle.mutate({ id: a._id, isActive: e.currentTarget.checked })}
                    aria-label="Enable automation"
                  />
                  {canManage && (
                    <Menu position="bottom-end">
                      <Menu.Target><ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon></Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setDrawer({ opened: true, automation: a })}>Edit</Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => confirmDelete({ message: `Delete automation "${a.name}"?`, onConfirm: () => remove.mutate(a._id) })}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Group>

              <Stack gap={6} mt="md">
                <Group gap={6}>
                  <Badge variant="light" color="indigo">When</Badge>
                  <Text size="sm" fw={500}>{TRIGGER_LABEL[a.trigger]}</Text>
                </Group>
                {a.conditions?.length > 0 && (
                  <Group gap={6} wrap="wrap">
                    <Badge variant="light" color="orange">If</Badge>
                    {a.conditions.map((c, i) => (
                      <Text key={i} size="sm" c="dimmed">
                        {i > 0 && 'and '}<b>{FIELDS_BY_ENTITY[entityOf(a.trigger)]?.find((f) => f.value === c.field)?.label || c.field}</b> {OPERATOR_LABEL[c.operator]} <b>{c.value}</b>
                      </Text>
                    ))}
                  </Group>
                )}
                <Group gap={6} wrap="wrap">
                  <Badge variant="light" color="teal">Then</Badge>
                  {a.actions.map((act, i) => (
                    <Group key={i} gap={4}>
                      {i > 0 && <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />}
                      <Text size="sm">{ACTION_LABEL[act.type]}</Text>
                    </Group>
                  ))}
                </Group>
              </Stack>

              <Group justify="space-between" mt="md" pt="sm" style={{ borderTop: '1px solid var(--app-border)' }}>
                <Text size="xs" c="dimmed">Ran {a.runCount || 0} time{a.runCount === 1 ? '' : 's'}</Text>
                <Text size="xs" c="dimmed">{a.lastRunAt ? `Last run ${dayjs(a.lastRunAt).fromNow()}` : 'Never run'}</Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <AutomationFormDrawer opened={drawer.opened} onClose={() => setDrawer({ opened: false, automation: null })} automation={drawer.automation} />
    </>
  );
}
