import { useState } from 'react';
import {
  SimpleGrid, Paper, Group, Text, Stack, Table, Badge, Button, Menu, Tabs, Progress, Tooltip, ScrollArea, Skeleton, Select,
} from '@mantine/core';
import {
  IconCash, IconAlertTriangle, IconCalendarDue, IconClockHour4, IconReceipt, IconBell, IconMail, IconBrandWhatsapp, IconFileTypePdf,
  IconChevronDown,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

import { PageHeader } from '../../components/PageHeader.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { formatCurrency } from '../../theme/theme.js';
import { financeApi, INVOICE_STATUS, MODE_LABEL, PAYMENT_MODES } from './financeApi.js';
import { RecordPaymentModal } from './RecordPaymentModal.jsx';
import { useReminder } from './useReminder.js';
import { appPath } from '../../utils/paths.js';

dayjs.extend(relativeTime);

const BUCKET_COLOR = { current: 'teal', d1_30: 'yellow', d31_60: 'orange', d61_90: 'red', d90_plus: 'grape' };
const compact = (n) => formatCurrency(n, { compact: true });

function AgingBar({ buckets, total }) {
  if (!total) return <Progress value={100} color="teal" size={18} radius="xl" />;
  return (
    <Progress.Root size={22} radius="xl">
      {buckets.filter((b) => b.amount > 0).map((b) => (
        <Tooltip key={b.key} label={`${b.label}: ${formatCurrency(b.amount)}`}>
          <Progress.Section value={(b.amount / total) * 100} color={BUCKET_COLOR[b.key]}>
            <Progress.Label>{Math.round((b.amount / total) * 100)}%</Progress.Label>
          </Progress.Section>
        </Tooltip>
      ))}
    </Progress.Root>
  );
}

function PaymentsTab() {
  const [mode, setMode] = useState(null);
  const { data: payments = [], isLoading } = useQuery({ queryKey: ['payments', mode], queryFn: () => financeApi.payments({ mode: mode || undefined }) });
  const total = payments.reduce((s, p) => s + p.amount + (p.tds || 0), 0);
  return (
    <Stack>
      <Group justify="space-between">
        <Select placeholder="All modes" data={PAYMENT_MODES} value={mode} onChange={setMode} clearable w={240} />
        <Text size="sm" c="dimmed">{payments.length} receipts · {formatCurrency(total)}</Text>
      </Group>
      {isLoading ? <Skeleton h={200} /> : payments.length === 0 ? <EmptyState title="No payments recorded" /> : (
        <ScrollArea>
          <Table verticalSpacing="sm" miw={760} highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Receipt</Table.Th><Table.Th>Date</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Invoice</Table.Th><Table.Th>Mode</Table.Th><Table.Th>Reference</Table.Th><Table.Th ta="right">Amount</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {payments.map((p) => (
                <Table.Tr key={p._id}>
                  <Table.Td fw={600}>{p.receiptNumber}</Table.Td>
                  <Table.Td>{dayjs(p.date).format('DD MMM YYYY')}</Table.Td>
                  <Table.Td>{p.company?.name || '—'}</Table.Td>
                  <Table.Td>{p.invoice?.invoiceNumber}</Table.Td>
                  <Table.Td><Badge variant="light" size="sm">{MODE_LABEL[p.mode]}</Badge></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{p.reference || '—'}</Text></Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} size="sm">{formatCurrency(p.amount)}</Text>
                    {p.tds > 0 && <Text size="xs" c="grape">+ TDS {formatCurrency(p.tds)}</Text>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  );
}

export function ReceivablesPage() {
  const [paying, setPaying] = useState(null);
  const remind = useReminder();
  const { data, isLoading } = useQuery({ queryKey: ['receivables'], queryFn: financeApi.receivables });

  if (isLoading || !data) {
    return (
      <Stack>
        <Skeleton h={48} w={300} />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={120} radius="lg" />)}</SimpleGrid>
        <Skeleton h={300} radius="lg" />
      </Stack>
    );
  }

  const { summary, buckets, customers, invoices } = data;

  return (
    <>
      <PageHeader title="Receivables" subtitle="Who owes you, how long it's been, and one-click payment follow-ups" />

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="lg">
        <StatCard label="Outstanding" value={compact(summary.outstanding)} icon={IconCash} color="indigo" hint={`${invoices.length} unpaid invoices`} />
        <StatCard label="Overdue" value={compact(summary.overdue)} icon={IconAlertTriangle} color="red" hint={`${summary.overdueCount} invoice${summary.overdueCount === 1 ? '' : 's'} past due`} />
        <StatCard label="Collected this month" value={compact(summary.collectedThisMonth)} icon={IconCalendarDue} color="teal" hint={`${summary.paymentsThisMonth} payments`} />
        <StatCard label="DSO" value={`${summary.dso} days`} icon={IconClockHour4} color="orange" hint="Avg. days to get paid (90-day)" />
      </SimpleGrid>

      <Paper p="lg" mb="lg">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Aging</Text>
          <Group gap="xs">
            {buckets.map((b) => (
              <Badge key={b.key} variant="dot" color={BUCKET_COLOR[b.key]}>{b.label}: {compact(b.amount)}</Badge>
            ))}
          </Group>
        </Group>
        <AgingBar buckets={buckets} total={summary.outstanding} />
      </Paper>

      <Paper p="lg">
        <Tabs defaultValue="invoices" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="invoices">Unpaid invoices ({invoices.length})</Tabs.Tab>
            <Tabs.Tab value="customers">By customer ({customers.length})</Tabs.Tab>
            <Tabs.Tab value="payments">Payments received</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="invoices">
            {invoices.length === 0 ? (
              <EmptyState title="Nothing outstanding 🎉" description="Every sent invoice has been paid." />
            ) : (
              <ScrollArea>
                <Table verticalSpacing="sm" miw={900} highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Due</Table.Th><Table.Th ta="right">Total</Table.Th>
                      <Table.Th ta="right">Received</Table.Th><Table.Th ta="right">Balance</Table.Th><Table.Th>Status</Table.Th><Table.Th>Last reminder</Table.Th><Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {invoices.map((inv) => {
                      const st = INVOICE_STATUS[inv.status];
                      return (
                        <Table.Tr key={inv._id}>
                          <Table.Td fw={600}>{inv.invoiceNumber}</Table.Td>
                          <Table.Td>{inv.customer}</Table.Td>
                          <Table.Td>
                            <Text size="sm">{inv.dueDate ? dayjs(inv.dueDate).format('DD MMM YYYY') : '—'}</Text>
                            {inv.daysOverdue > 0 && <Text size="xs" c={BUCKET_COLOR[inv.bucket]} fw={600}>{inv.daysOverdue} days overdue</Text>}
                          </Table.Td>
                          <Table.Td ta="right">{formatCurrency(inv.total)}</Table.Td>
                          <Table.Td ta="right" c="teal">{inv.amountPaid ? formatCurrency(inv.amountPaid) : '—'}</Table.Td>
                          <Table.Td ta="right" fw={700}>{formatCurrency(inv.balance)}</Table.Td>
                          <Table.Td><Badge variant="light" color={st.color}>{st.label}</Badge></Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{inv.lastReminderAt ? `${dayjs(inv.lastReminderAt).fromNow()} (${inv.reminderCount})` : 'Never'}</Text></Table.Td>
                          <Table.Td>
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <Button size="xs" variant="light" leftSection={<IconReceipt size={14} />} onClick={() => setPaying({ ...inv, _id: inv._id })}>Record payment</Button>
                              <Menu position="bottom-end">
                                <Menu.Target>
                                  <Button size="xs" variant="default" leftSection={<IconBell size={14} />} rightSection={<IconChevronDown size={12} />} loading={remind.isPending && remind.variables?.id === inv._id}>Remind</Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item leftSection={<IconMail size={14} />} disabled={!inv.contact?.email} onClick={() => remind.mutate({ id: inv._id, channel: 'email' })}>By email</Menu.Item>
                                  <Menu.Item leftSection={<IconBrandWhatsapp size={14} />} disabled={!inv.contact?.phone} onClick={() => remind.mutate({ id: inv._id, channel: 'whatsapp' })}>By WhatsApp</Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Item leftSection={<IconFileTypePdf size={14} />} onClick={() => window.open(appPath(`/print/invoice/${inv._id}`), '_blank')}>Invoice PDF</Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="customers">
            <ScrollArea>
              <Table verticalSpacing="sm" miw={820} highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Customer</Table.Th><Table.Th ta="right">Invoices</Table.Th>
                    {buckets.map((b) => <Table.Th key={b.key} ta="right">{b.label}</Table.Th>)}
                    <Table.Th ta="right">Total due</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {customers.map((c) => (
                    <Table.Tr key={c.key}>
                      <Table.Td fw={600}>{c.name}</Table.Td>
                      <Table.Td ta="right">{c.invoices}</Table.Td>
                      {buckets.map((b) => (
                        <Table.Td key={b.key} ta="right" c={c[b.key] ? BUCKET_COLOR[b.key] : 'dimmed'} fw={c[b.key] ? 600 : 400}>
                          {c[b.key] ? compact(c[b.key]) : '—'}
                        </Table.Td>
                      ))}
                      <Table.Td ta="right" fw={700}>{formatCurrency(c.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="payments"><PaymentsTab /></Tabs.Panel>
        </Tabs>
      </Paper>

      <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />
    </>
  );
}
