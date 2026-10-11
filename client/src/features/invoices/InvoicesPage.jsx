import { useState } from 'react';
import { Button, Text, ActionIcon, Menu, Badge, Select } from '@mantine/core';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash, IconCheck, IconFileTypePdf, IconReceipt, IconMail, IconBrandWhatsapp } from '@tabler/icons-react';
import { RecordPaymentModal } from '../finance/RecordPaymentModal.jsx';
import { useReminder } from '../finance/useReminder.js';
import { INVOICE_STATUS } from '../finance/financeApi.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { useResourceList } from '../../hooks/useResourceList.js';
import { invoicesApi } from '../../api/invoicesApi.js';
import { InvoiceFormDrawer } from './InvoiceFormDrawer.jsx';
import { appPath } from '../../utils/paths.js';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

const STATUS_FILTER = [{ value: '', label: 'All statuses' }, ...Object.entries(INVOICE_STATUS).map(([value, s]) => ({ value, label: s.label }))];
const OPEN = ['sent', 'partially_paid', 'overdue'];

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [paying, setPaying] = useState(null);
  const remind = useReminder();
  const list = useResourceList('invoices', invoicesApi, statusFilter ? { status: statusFilter } : {});
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: invoicesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notifications.show({ message: 'Invoice deleted', color: 'gray' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: invoicesApi.markPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      notifications.show({ message: 'Invoice marked as paid — receipt recorded', color: 'teal' });
    },
  });

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (row) => <Text fw={500}>{row.invoiceNumber}</Text> },
    { key: 'company', header: 'Company', render: (row) => row.company?.name || '—' },
    { key: 'total', header: 'Total', render: (row) => formatCurrency(row.total) },
    {
      key: 'balance',
      header: 'Balance',
      render: (row) => (row.status === 'void' ? '—' : row.balance > 0 ? <Text size="sm" fw={600} c={row.status === 'overdue' ? 'red' : undefined}>{formatCurrency(row.balance)}</Text> : <Text size="sm" c="teal">Settled</Text>),
    },
    { key: 'dueDate', header: 'Due', render: (row) => (row.dueDate ? dayjs(row.dueDate).format('DD MMM YYYY') : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge color={INVOICE_STATUS[row.status]?.color} variant="light">{INVOICE_STATUS[row.status]?.label || row.status}</Badge>,
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
            <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={(e) => { e.stopPropagation(); window.open(appPath(`/print/invoice/${row._id}`), '_blank'); }}>
              Download PDF
            </Menu.Item>
            {OPEN.includes(row.status) && (
              <>
                <Menu.Item leftSection={<IconReceipt size={14} />} onClick={(e) => { e.stopPropagation(); setPaying(row); }}>Record payment</Menu.Item>
                <Menu.Item leftSection={<IconMail size={14} />} disabled={!row.contact?.email} onClick={(e) => { e.stopPropagation(); remind.mutate({ id: row._id, channel: 'email' }); }}>Email reminder</Menu.Item>
                <Menu.Item leftSection={<IconBrandWhatsapp size={14} />} disabled={!row.contact?.phone} onClick={(e) => { e.stopPropagation(); remind.mutate({ id: row._id, channel: 'whatsapp' }); }}>WhatsApp reminder</Menu.Item>
              </>
            )}
            {!['paid', 'void'].includes(row.status) && (
              <Menu.Item
                leftSection={<IconCheck size={14} />}
                onClick={(e) => { e.stopPropagation(); markPaidMutation.mutate(row._id); }}
              >
                Mark fully paid
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete({
                  message: `Delete invoice "${row.invoiceNumber}"? This cannot be undone.`,
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
        title="Invoices"
        subtitle="Bill your customers and track payments"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setDrawerOpened(true); }}>New invoice</Button>}
      />

      <DataTable
        toolbar={<Select data={STATUS_FILTER} value={statusFilter} onChange={(v) => setStatusFilter(v || '')} w={170} allowDeselect={false} />}
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
        emptyTitle="No invoices yet"
        emptyDescription="Create an invoice directly, or convert an accepted quote."
      />

      <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />
      <InvoiceFormDrawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} invoice={editing} />
    </>
  );
}
