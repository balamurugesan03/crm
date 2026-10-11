import { Popover, ActionIcon, Indicator, Stack, Text, UnstyledButton, Group, Button, ScrollArea } from '@mantine/core';
import { IconBell, IconCheck } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

import { notificationsApi } from '../../api/notificationsApi.js';
import { EmptyState } from '../../components/EmptyState.jsx';

dayjs.extend(relativeTime);

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  function handleClick(notification) {
    if (!notification.isRead) readMutation.mutate(notification._id);
    setOpened(false);
    if (notification.link) navigate(notification.link);
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" width={340} shadow="md">
      <Popover.Target>
        <Indicator disabled={unreadCount === 0} color="red" size={16} label={unreadCount > 9 ? '9+' : unreadCount}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setOpened((o) => !o)}>
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <Text fw={600} size="sm">Notifications</Text>
          {unreadCount > 0 && (
            <Button variant="subtle" size="xs" leftSection={<IconCheck size={12} />} onClick={() => readAllMutation.mutate()}>
              Mark all read
            </Button>
          )}
        </Group>
        <ScrollArea.Autosize mah={360}>
          {items.length === 0 ? (
            <EmptyState title="No notifications" description="You're all caught up." />
          ) : (
            <Stack gap={0}>
              {items.map((n) => (
                <UnstyledButton
                  key={n._id}
                  p="sm"
                  onClick={() => handleClick(n)}
                  style={{
                    borderBottom: '1px solid var(--app-border)',
                    background: n.isRead ? 'transparent' : 'var(--app-highlight)',
                  }}
                >
                  <Text size="sm" fw={500}>{n.title}</Text>
                  {n.body && <Text size="xs" c="dimmed" lineClamp={1}>{n.body}</Text>}
                  <Text size="xs" c="dimmed" mt={2}>{dayjs(n.createdAt).fromNow()}</Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
