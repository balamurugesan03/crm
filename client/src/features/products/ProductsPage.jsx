import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { productsApi } from '../../api/productsApi.js';
import { ProductFormDrawer } from './ProductFormDrawer.jsx';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const list = useResourceList('products', productsApi);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notifications.show({ message: 'Product deleted', color: 'gray' });
    },
  });

  const columns = [
    { key: 'name', header: 'Name', render: (row) => <Text fw={500}>{row.name}</Text> },
    { key: 'sku', header: 'SKU' },
    { key: 'price', header: 'Price', render: (row) => formatCurrency(row.price) },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => <Badge color={row.isActive ? 'teal' : 'gray'} variant="light">{row.isActive ? 'Active' : 'Inactive'}</Badge>,
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
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={(e) => { e.stopPropagation(); setEditing(row); setDrawerOpened(true); }}>
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
        title="Products"
        subtitle="Your pricing catalog for quotes and invoices"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>New product</Button>}
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
        onRowClick={(row) => { setEditing(row); setDrawerOpened(true); }}
        emptyTitle="No products yet"
        emptyDescription="Add products or services to use them in quotes and invoices."
      />

      <ProductFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} product={editing} />
    </>
  );
}
