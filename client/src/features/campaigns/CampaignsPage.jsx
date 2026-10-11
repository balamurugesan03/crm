import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { campaignsApi } from '../../api/campaignsApi.js';
import { CampaignFormDrawer } from './CampaignFormDrawer.jsx';

const STATUS_COLORS = { planned: 'gray', active: 'teal', paused: 'orange', completed: 'indigo' };
const TYPE_LABELS = { email: 'Email', social: 'Social', event: 'Event', webinar: 'Webinar', other: 'Other' };

export function CampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useResourceList('campaigns', campaignsApi);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: campaignsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      notifications.show({ message: 'Campaign deleted', color: 'gray' });
    },
  });

  const columns = [
    { key: 'name', header: 'Name', render: (row) => <Text fw={500}>{row.name}</Text> },
    { key: 'type', header: 'Type', render: (row) => TYPE_LABELS[row.type] || row.type },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge color={STATUS_COLORS[row.status]} variant="light" tt="capitalize">{row.status}</Badge>,
    },
    { key: 'leadCount', header: 'Leads', render: (row) => row.leadCount },
    { key: 'startDate', header: 'Starts', render: (row) => (row.startDate ? dayjs(row.startDate).format('DD MMM YYYY') : '—') },
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
                  message: `Delete campaign "${row.name}"? This cannot be undone.`,
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
        title="Campaigns"
        subtitle="Marketing initiatives and the leads they generate"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>New campaign</Button>}
      />

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.setSearch}
        page={list.page}
        pages={list.pages}
        onPageChange={list.setPage}
        onRowClick={(row) => navigate(`/campaigns/${row._id}`)}
        emptyTitle="No campaigns yet"
        emptyDescription="Create a campaign to track leads it generates."
      />

      <CampaignFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} campaign={editing} />
    </>
  );
}
