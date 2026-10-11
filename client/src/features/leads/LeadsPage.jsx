import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge, Select, Group, SegmentedControl, Modal } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash, IconArrowRight, IconSparkles } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { leadsApi } from '../../api/leadsApi.js';
import { LeadFormDrawer } from './LeadFormDrawer.jsx';
import { LeadScoreBadge } from './LeadScoreBadge.jsx';
import { AiInsightsPanel } from '../ai/AiInsightsPanel.jsx';
import { DataTransferMenu } from '../../components/DataTransferMenu.jsx';

const STATUS_COLORS = { new: 'blue', contacted: 'grape', qualified: 'teal', unqualified: 'gray', converted: 'green' };
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'converted', label: 'Converted' },
];

export function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('score');
  const [aiLead, setAiLead] = useState(null);
  const list = useResourceList('leads', leadsApi, { ...(statusFilter ? { status: statusFilter } : {}), sort });
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);
  useOpenOnNewParam(() => { setEditing(null); setDrawerOpened(true); });

  const deleteMutation = useMutation({
    mutationFn: leadsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notifications.show({ message: 'Lead deleted', color: 'gray' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: leadsApi.convert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: 'Lead converted — contact and deal created', color: 'teal' });
      navigate('/deals');
    },
    onError: (err) => {
      notifications.show({ message: err?.response?.data?.message || 'Could not convert lead', color: 'red' });
    },
  });

  const columns = [
    { key: 'name', header: 'Name', render: (row) => <Text fw={500}>{row.name}</Text> },
    { key: 'score', header: 'Score', render: (row) => <LeadScoreBadge score={row.score} /> },
    { key: 'email', header: 'Email', render: (row) => row.email || '—' },
    { key: 'source', header: 'Source', render: (row) => <Text tt="capitalize" size="sm">{row.source?.replace('_', ' ')}</Text> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge color={STATUS_COLORS[row.status]} variant="light" tt="capitalize">{row.status}</Badge>,
    },
    {
      key: 'estimatedValue',
      header: 'Est. value',
      render: (row) => `₹${(row.estimatedValue || 0).toLocaleString('en-IN')}`,
    },
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
              leftSection={<IconSparkles size={14} />}
              color="grape"
              onClick={(e) => { e.stopPropagation(); setAiLead(row); }}
            >
              AI insights
            </Menu.Item>
            {row.status !== 'converted' && (
              <Menu.Item
                leftSection={<IconArrowRight size={14} />}
                onClick={(e) => { e.stopPropagation(); convertMutation.mutate(row._id); }}
              >
                Convert to deal
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete lead "${row.name}"? This cannot be undone.`,
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
        title="Leads"
        subtitle="Prospects working their way toward a deal"
        action={
          <>
            <DataTransferMenu entity="leads" label="Leads" />
            <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>
              New lead
            </Button>
          </>
        }
      />

      <DataTable
        toolbar={
          <Group gap="xs">
            <Select data={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v || '')} w={170} allowDeselect={false} />
            <SegmentedControl
              value={sort}
              onChange={setSort}
              data={[
                { value: 'score', label: 'Top scored' },
                { value: 'recent', label: 'Newest' },
              ]}
            />
          </Group>
        }
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
        emptyTitle="No leads yet"
        emptyDescription="Capture new prospects here before they become deals."
      />

      <Modal
        opened={Boolean(aiLead)}
        onClose={() => setAiLead(null)}
        size="xl"
        title={<Group gap="xs"><IconSparkles size={18} color="var(--mantine-color-grape-6)" /><Text fw={700}>AI insights · {aiLead?.name}</Text></Group>}
      >
        {aiLead && <AiInsightsPanel entityType="Lead" entityId={aiLead._id} email={aiLead.email} phone={aiLead.phone} />}
      </Modal>

      <LeadFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} lead={editing} />
    </>
  );
}
