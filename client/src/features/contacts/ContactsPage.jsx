import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Avatar, Group } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { DataTransferMenu } from '../../components/DataTransferMenu.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { contactsApi } from '../../api/contactsApi.js';
import { ContactFormDrawer } from './ContactFormDrawer.jsx';

export function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useResourceList('contacts', contactsApi);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);
  useOpenOnNewParam(() => { setEditing(null); setDrawerOpened(true); });

  const deleteMutation = useMutation({
    mutationFn: contactsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      notifications.show({ message: 'Contact deleted', color: 'gray' });
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Group gap={8} wrap="nowrap">
          <Avatar size={28} radius="xl" color="indigo">{row.firstName?.[0]}</Avatar>
          <Text fw={500}>{row.firstName} {row.lastName}</Text>
        </Group>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'company', header: 'Company', render: (row) => row.company?.name || '—' },
    { key: 'jobTitle', header: 'Title' },
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
                  message: `Delete "${row.firstName} ${row.lastName || ''}"? This cannot be undone.`,
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
        title="Contacts"
        subtitle="People you're building relationships with"
        action={
          <>
            <DataTransferMenu entity="contacts" label="Contacts" />
            <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>
              New contact
            </Button>
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
        onRowClick={(row) => navigate(`/contacts/${row._id}`)}
        emptyTitle="No contacts yet"
        emptyDescription="Add your first contact to start tracking conversations and deals."
      />

      <ContactFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} contact={editing} />
    </>
  );
}
