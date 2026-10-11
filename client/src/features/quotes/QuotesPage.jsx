import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash, IconFileInvoice, IconFileTypePdf } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { quotesApi } from '../../api/quotesApi.js';
import { QuoteFormDrawer } from './QuoteFormDrawer.jsx';
import { appPath } from '../../utils/paths.js';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

const STATUS_COLORS = { draft: 'gray', sent: 'blue', accepted: 'teal', rejected: 'red' };

export function QuotesPage() {
  const queryClient = useQueryClient();
  const list = useResourceList('quotes', quotesApi);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: quotesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      notifications.show({ message: 'Quote deleted', color: 'gray' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: quotesApi.convertToInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notifications.show({ message: 'Invoice created from quote', color: 'teal' });
    },
  });

  const columns = [
    { key: 'quoteNumber', header: 'Quote #', render: (row) => <Text fw={500}>{row.quoteNumber}</Text> },
    { key: 'company', header: 'Company', render: (row) => row.company?.name || '—' },
    { key: 'contact', header: 'Contact', render: (row) => (row.contact ? `${row.contact.firstName} ${row.contact.lastName || ''}` : '—') },
    { key: 'total', header: 'Total', render: (row) => formatCurrency(row.total) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge color={STATUS_COLORS[row.status]} variant="light" tt="capitalize">{row.status}</Badge>,
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
            <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={(e) => { e.stopPropagation(); window.open(appPath(`/print/quote/${row._id}`), '_blank'); }}>
              Download PDF
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileInvoice size={14} />}
              onClick={(e) => { e.stopPropagation(); convertMutation.mutate(row._id); }}
            >
              Convert to invoice
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete quote "${row.quoteNumber}"? This cannot be undone.`,
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
        title="Quotes"
        subtitle="Send priced proposals and convert them to invoices"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>New quote</Button>}
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
        emptyTitle="No quotes yet"
        emptyDescription="Create a quote to send priced proposals to prospects."
      />

      <QuoteFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} quote={editing} />
    </>
  );
}
