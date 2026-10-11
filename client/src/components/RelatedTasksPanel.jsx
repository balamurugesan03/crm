import { useState } from 'react';
import { Stack, Group, Checkbox, Text, Button, Badge } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { tasksApi } from '../api/tasksApi.js';
import { EmptyState } from './EmptyState.jsx';
import { TaskFormDrawer } from '../features/tasks/TaskFormDrawer.jsx';

const PRIORITY_COLORS = { low: 'gray', medium: 'blue', high: 'red' };

export function RelatedTasksPanel({ relatedToModel, relatedToId, relatedToLabel }) {
  const queryClient = useQueryClient();
  const [drawerOpened, setDrawerOpened] = useState(false);

  const queryKey = ['tasks', { relatedToModel, relatedToId }];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => tasksApi.list({ relatedToModel, relatedToId, limit: 50 }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const items = data?.items || [];

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{items.length} task{items.length === 1 ? '' : 's'}</Text>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setDrawerOpened(true)}>
          New task
        </Button>
      </Group>

      {!isLoading && items.length === 0 && (
        <EmptyState title="No tasks yet" description="Create a task linked to this record to track follow-ups." />
      )}

      <Stack gap={6}>
        {items.map((task) => (
          <Group key={task._id} justify="space-between" wrap="nowrap">
            <Checkbox
              label={task.title}
              checked={task.status === 'done'}
              onChange={(e) => toggleMutation.mutate({ id: task._id, status: e.currentTarget.checked ? 'done' : 'pending' })}
            />
            <Group gap={6} wrap="nowrap">
              {task.dueDate && <Text size="xs" c="dimmed">{dayjs(task.dueDate).format('DD MMM')}</Text>}
              <Badge size="xs" variant="light" color={PRIORITY_COLORS[task.priority]} tt="capitalize">{task.priority}</Badge>
            </Group>
          </Group>
        ))}
      </Stack>

      <TaskFormDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        relatedToModel={relatedToModel}
        relatedToId={relatedToId}
        relatedToLabel={relatedToLabel}
      />
    </Stack>
  );
}
