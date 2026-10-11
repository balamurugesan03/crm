import { Stack, TextInput, Button, Group, Select, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { tasksApi } from '../../api/tasksApi.js';
import { usersApi } from '../../api/usersApi.js';

const EMPTY = { title: '', type: 'todo', dueDate: null, priority: 'medium', assignedTo: null };

export function TaskFormDrawer({ opened, onClose, task, relatedToModel, relatedToId, relatedToLabel }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(task);

  const { data: users } = useQuery({ queryKey: ['team'], queryFn: usersApi.list, enabled: opened });
  const userOptions = (users || []).map((u) => ({ value: u.id, label: u.name }));

  const form = useForm({
    initialValues: EMPTY,
    validate: { title: (v) => (v.trim() ? null : 'Title is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        task
          ? { ...EMPTY, ...task, assignedTo: task.assignedTo?._id || task.assignedTo || null, dueDate: task.dueDate ? new Date(task.dueDate) : null }
          : EMPTY,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, task]);

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = isEdit ? values : { ...values, relatedToModel, relatedToId };
      return isEdit ? tasksApi.update(task._id, values) : tasksApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notifications.show({ message: isEdit ? 'Task updated' : 'Task created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit task' : 'New task'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          {relatedToLabel && !isEdit && (
            <Text size="sm" c="dimmed">Linked to <Text span fw={500} c="dark">{relatedToLabel}</Text></Text>
          )}
          <TextInput label="Title" required {...form.getInputProps('title')} />
          <Select label="Type" data={['call', 'email', 'meeting', 'todo']} {...form.getInputProps('type')} />
          <Select label="Priority" data={['low', 'medium', 'high']} {...form.getInputProps('priority')} />
          <Select label="Assign to" placeholder="Me" data={userOptions} searchable clearable {...form.getInputProps('assignedTo')} />
          <DateTimePicker label="Due date" clearable {...form.getInputProps('dueDate')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create task'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
