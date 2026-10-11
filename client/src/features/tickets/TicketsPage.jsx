import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge, Select, Group } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { DataTransferMenu } from '../../components/DataTransferMenu.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { ticketsApi } from '../../api/ticketsApi.js';
import { TicketFormDrawer } from './TicketFormDrawer.jsx';

const STATUS_COLORS = { open: 'blue', in_progress: 'indigo', waiting: 'orange', resolved: 'teal', closed: 'gray' };
const PRIORITY_COLORS = { low: 'gray', medium: 'blue', high: 'orange', urgent: 'red' };
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const list = useResourceList('tickets', ticketsApi, statusFilter ? { status: statusFilter } : {});
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);
  useOpenOnNewParam(() => { setEditing(null); setDrawerOpened(true); });

  const deleteMutation = useMutation({
    mutationFn: ticketsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      notifications.show({ message: 'Ticket deleted', color: 'gray' });
    },
  });

  const columns = [
    { key: 'ticketNumber', header: 'Ticket #', render: (row) => <Text fw={500}>{row.ticketNumber}</Text> },
    { key: 'subject', header: 'Subject' },
    { key: 'company', header: 'Company', render: (row) => row.company?.name || '—' },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <Badge color={PRIORITY_COLORS[row.priority]} variant="light" tt="capitalize">{row.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge color={STATUS_COLORS[row.status]} variant="light" tt="capitalize">{row.status.replace('_', ' ')}</Badge>,
    },
    { key: 'createdAt', header: 'Opened', render: (row) => dayjs(row.createdAt).format('DD MMM YYYY') },
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
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={(e) => { e.stopPropagation(); setEditing(row); setDrawerOpened(true); }}>
              Edit
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete ticket "${row.ticketNumber}"? This cannot be undone.`,
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
        title="Tickets"
        subtitle="Customer support requests"
        action={
          <>
            <DataTransferMenu entity="tickets" label="Tickets" canImport={false} />
            <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>New ticket</Button>
          </>
        }
      />

      <DataTable
        toolbar={<Select data={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v || '')} w={180} allowDeselect={false} />}
        total={list.total}
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.setSearch}
        page={list.page}
        pages={list.pages}
        onPageChange={list.setPage}
        onRowClick={(row) => { setEditing(row); setDrawerOpened(true); }}
        emptyTitle="No tickets yet"
        emptyDescription="Support requests from your customers will show up here."
      />

      <TicketFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} ticket={editing} />
    </>
  );
}
