import { useState } from 'react';
import { Button, Text, ActionIcon, Menu } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { DataTransferMenu } from '../../components/DataTransferMenu.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { companiesApi } from '../../api/companiesApi.js';
import { CompanyFormDrawer } from './CompanyFormDrawer.jsx';

export function CompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useResourceList('companies', companiesApi);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: companiesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: 'Company deleted', color: 'gray' });
    },
  });

  function openCreate() {
    setEditing(null);
    setDrawerOpened(true);
  }

  function openEdit(company) {
    setEditing(company);
    setDrawerOpened(true);
  }

  const columns = [
    { key: 'name', header: 'Name', render: (row) => <Text fw={500}>{row.name}</Text> },
    { key: 'domain', header: 'Domain' },
    { key: 'industry', header: 'Industry' },
    { key: 'phone', header: 'Phone' },
    { key: 'ownerUser', header: 'Owner', render: (row) => row.ownerUser?.name || '—' },
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
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
              Edit
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete "${row.name}"? This cannot be undone.`,
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
        title="Companies"
        subtitle="Accounts your team is selling into"
        action={
          <>
            <DataTransferMenu entity="companies" label="Companies" />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New company</Button>
          </>
        }
      />

      <DataTable
        total={list.total}
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        search={list.search}
        onSearchChange={list.setSearch}
        page={list.page}
        pages={list.pages}
        onPageChange={list.setPage}
        onRowClick={(row) => navigate(`/companies/${row._id}`)}
        emptyTitle="No companies yet"
        emptyDescription="Add the companies you work with to link contacts and deals to them."
      />

      <CompanyFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} company={editing} />
    </>
  );
}
