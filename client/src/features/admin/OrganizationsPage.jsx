import { Text, ActionIcon, Menu, Badge, Group } from '@mantine/core';
import { IconDotsVertical, IconEye, IconLockPause, IconLockOpen } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { adminApi } from '../../api/adminApi.js';

const PLAN_COLORS = { trial: 'gray', starter: 'blue', pro: 'indigo', enterprise: 'grape' };
const STATUS_COLORS = { trialing: 'blue', active: 'teal', past_due: 'orange', canceled: 'red' };

export function OrganizationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useResourceList('admin-organizations', { list: adminApi.listOrganizations });

  const suspendMutation = useMutation({
    mutationFn: ({ id, isSuspended }) => adminApi.updateOrganization(id, { isSuspended }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      notifications.show({
        message: variables.isSuspended ? 'Organization suspended' : 'Organization reactivated',
        color: variables.isSuspended ? 'orange' : 'teal',
      });
    },
  });

  const columns = [
    { key: 'name', header: 'Organization', render: (row) => <Text fw={500}>{row.name}</Text> },
    { key: 'userCount', header: 'Users', render: (row) => row.userCount },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) => <Badge color={PLAN_COLORS[row.plan]} variant="light" tt="capitalize">{row.plan}</Badge>,
    },
    {
      key: 'subscriptionStatus',
      header: 'Status',
      render: (row) => <Badge color={STATUS_COLORS[row.subscriptionStatus]} variant="light" tt="capitalize">{row.subscriptionStatus.replace('_', ' ')}</Badge>,
    },
    {
      key: 'isSuspended',
      header: '',
      render: (row) => (row.isSuspended ? <Badge color="red" variant="filled" size="sm">Suspended</Badge> : null),
    },
    { key: 'createdAt', header: 'Joined', render: (row) => dayjs(row.createdAt).format('DD MMM YYYY') },
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
            <Menu.Item leftSection={<IconEye size={14} />} onClick={(e) => { e.stopPropagation(); navigate(`/admin/organizations/${row._id}`); }}>
              View details
            </Menu.Item>
            {row.isSuspended ? (
              <Menu.Item
                leftSection={<IconLockOpen size={14} />}
                onClick={(e) => { e.stopPropagation(); suspendMutation.mutate({ id: row._id, isSuspended: false }); }}
              >
                Reactivate
              </Menu.Item>
            ) : (
              <Menu.Item
                color="orange"
                leftSection={<IconLockPause size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete({
                    title: 'Suspend this organization?',
                    message: `Users in "${row.name}" will be unable to log in until reactivated.`,
                    confirmLabel: 'Suspend',
                    confirmColor: 'orange',
                    onConfirm: () => suspendMutation.mutate({ id: row._id, isSuspended: true }),
                  });
                }}
              >
                Suspend
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Organizations" subtitle="Every tenant workspace on the platform" />

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.setSearch}
        page={list.page}
        pages={list.pages}
        onPageChange={list.setPage}
        onRowClick={(row) => navigate(`/admin/organizations/${row._id}`)}
        emptyTitle="No organizations yet"
        emptyDescription="Organizations will appear here as people sign up."
      />
    </>
  );
}
