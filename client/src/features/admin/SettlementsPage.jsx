import { Text, Badge } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { useResourceList } from '../../hooks/useResourceList.js';
import { adminApi, PAYMENT_MODE_OPTIONS, BILLING_CYCLE_LABELS, formatINR } from '../../api/adminApi.js';

const MODE_LABELS = Object.fromEntries(PAYMENT_MODE_OPTIONS.map((o) => [o.value, o.label]));

export function SettlementsPage() {
  const navigate = useNavigate();
  const list = useResourceList('admin-settlements', { list: adminApi.listSettlements });

  const columns = [
    { key: 'paidAt', header: 'Paid on', render: (row) => dayjs(row.paidAt).format('DD MMM YYYY') },
    { key: 'organization', header: 'Organization', render: (row) => <Text fw={500}>{row.organization?.name || 'Deleted organization'}</Text> },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) => (
        <div>
          <Text size="sm">{row.planName || row.plan}</Text>
          <Badge size="xs" variant="light" color={row.billingCycle === 'one_time' ? 'grape' : 'blue'}>
            {BILLING_CYCLE_LABELS[row.billingCycle] || row.billingCycle}
          </Badge>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => <Text fw={600}>{formatINR(row.amount)}</Text> },
    {
      key: 'paymentMode',
      header: 'Mode / ref',
      render: (row) => (
        <div>
          <Text size="sm">{MODE_LABELS[row.paymentMode] || row.paymentMode}</Text>
          {row.reference && <Text size="xs" c="dimmed">{row.reference}</Text>}
        </div>
      ),
    },
    { key: 'periodEnd', header: 'Valid until', render: (row) => (row.periodEnd ? dayjs(row.periodEnd).format('DD MMM YYYY') : 'Lifetime') },
    { key: 'recordedBy', header: 'Recorded by', render: (row) => <Text size="sm" c="dimmed">{row.recordedBy?.name || '—'}</Text> },
  ];

  return (
    <>
      <PageHeader
        title="Settlements"
        subtitle={`Every subscription payment received${list.data ? ` · ${formatINR(list.data.totalAmount)} total` : ''}`}
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
        onRowClick={(row) => row.organization?._id && navigate(`/admin/organizations/${row.organization._id}`)}
        emptyTitle="No settlements yet"
        emptyDescription="Record a payment from an organization's page."
      />
    </>
  );
}
