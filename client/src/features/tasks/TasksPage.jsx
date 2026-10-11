import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge, Checkbox, SegmentedControl, Group } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { tasksApi } from '../../api/tasksApi.js';
import { TaskFormDrawer } from './TaskFormDrawer.jsx';

const PRIORITY_COLORS = { low: 'gray', medium: 'blue', high: 'red' };

export function TasksPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const list = useResourceList('tasks', tasksApi, statusFilter ? { status: statusFilter } : {});
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);
  useOpenOnNewParam(() => { setEditing(null); setDrawerOpened(true); });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({ message: 'Task deleted', color: 'gray' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const columns = [
    {
      key: 'title',
      header: 'Task',
      render: (row) => (
        <Checkbox
          label={row.title}
          checked={row.status === 'done'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            toggleMutation.mutate({ id: row._id, status: e.currentTarget.checked ? 'done' : 'pending' })
          }
        />
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Text tt="capitalize" size="sm">{row.type}</Text> },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <Badge color={PRIORITY_COLORS[row.priority]} variant="light" tt="capitalize">{row.priority}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Due',
      render: (row) => (row.dueDate ? dayjs(row.dueDate).format('DD MMM YYYY, h:mm A') : '—'),
    },
    { key: 'assignedTo', header: 'Assigned to', render: (row) => row.assignedTo?.name || '—' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" onClick={(e) => e.stopPropagation()}>
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconPencil size={14} />}
              onClick={(e) => { e.stopPropagation(); setEditing(row); setDrawerOpened(true); }}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete task "${row.title}"? This cannot be undone.`,
                  onConfirm: () => deleteMutation.mutate(row._id),
                });
              }}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Calls, emails, meetings and to-dos"
        action={
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>
            New task
          </Button>
        }
      />

      <Group mb="sm">
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { label: 'Pending', value: 'pending' },
            { label: 'Done', value: 'done' },
            { label: 'All', value: '' },
          ]}
        />
      </Group>

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.setSearch}
        page={list.page}
        pages={list.pages}
        onPageChange={list.setPage}
        onRowClick={(row) => { setEditing(row); setDrawerOpened(true); }}
        emptyTitle="No tasks here"
        emptyDescription="Create tasks to stay on top of calls, emails and follow-ups."
      />

      <TaskFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} task={editing} />
    </>
  );
}
