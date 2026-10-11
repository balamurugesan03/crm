import { useState } from 'react';
import { SimpleGrid, Paper, Group, Text, Stack, Table, Tabs, Button, Alert, ScrollArea, Skeleton, Badge, Anchor } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconDownload, IconAlertTriangle, IconCalendarStats, IconInfoCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { formatCurrency } from '../../theme/theme.js';
import { financeApi } from './financeApi.js';

const SECTIONS = [
  { key: 'b2b', label: 'B2B', hint: 'Sales to GST-registered customers (invoice-wise)' },
  { key: 'b2cl', label: 'B2C Large', hint: 'Inter-state sales to unregistered buyers above ₹1 lakh' },
  { key: 'b2cs', label: 'B2C Small', hint: 'Other sales to unregistered buyers, summarised by state and rate' },
  { key: 'hsn', label: 'HSN summary', hint: 'Item-wise summary by HSN/SAC and rate' },
];
const MONEY_COLS = new Set(['Invoice Value', 'Taxable Value', 'Total Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount']);

function Kpi({ label, value, color }) {
  return (
    <Paper p="md">
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">{label}</Text>
      <Text fw={750} fz={20} c={color}>{value}</Text>
    </Paper>
  );
}

export function GstReturnsPage() {
  const [month, setMonth] = useState(dayjs().subtract(1, 'month').startOf('month').toDate());
  const period = dayjs(month).format('YYYY-MM');
  const { data, isLoading } = useQuery({ queryKey: ['gstr1', period], queryFn: () => financeApi.gstr1(period) });

  return (
    <>
      <PageHeader
        title="GST returns"
        subtitle="GSTR-1 outward supplies, ready to upload via the GST offline tool"
        action={<MonthPickerInput value={month} onChange={(v) => v && setMonth(v)} valueFormat="MMMM YYYY" w={180} leftSection={<IconCalendarStats size={16} />} maxDate={new Date()} />}
      />

      {isLoading || !data ? (
        <Stack><Skeleton h={90} radius="lg" /><Skeleton h={300} radius="lg" /></Stack>
      ) : (
        <Stack>
          {!data.sellerGstin && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
              Your GSTIN is not set. Add it in <Anchor component={Link} to="/settings?tab=organization">Settings → Organization</Anchor> so invoices and returns use the correct place of supply.
            </Alert>
          )}
          {data.summary.missingHsn > 0 && (
            <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
              {data.summary.missingHsn} line item{data.summary.missingHsn > 1 ? 's are' : ' is'} missing an HSN/SAC code. Add codes on products so the HSN summary is complete.
            </Alert>
          )}

          <SimpleGrid cols={{ base: 2, md: 3, lg: 6 }}>
            <Kpi label="Invoices" value={data.summary.invoices} />
            <Kpi label="Taxable value" value={formatCurrency(data.summary.taxable)} />
            <Kpi label="IGST" value={formatCurrency(data.summary.igst)} color="grape" />
            <Kpi label="CGST" value={formatCurrency(data.summary.cgst)} color="indigo" />
            <Kpi label="SGST" value={formatCurrency(data.summary.sgst)} color="indigo" />
            <Kpi label="Total tax" value={formatCurrency(data.summary.totalTax)} color="teal" />
          </SimpleGrid>

          <Paper p="lg">
            <Tabs defaultValue="b2b" keepMounted={false}>
              <Tabs.List mb="md">
                {SECTIONS.map((s) => (
                  <Tabs.Tab key={s.key} value={s.key} rightSection={<Badge size="xs" variant="light" color="gray">{data.sections[s.key].rows.length}</Badge>}>{s.label}</Tabs.Tab>
                ))}
              </Tabs.List>
              {SECTIONS.map((s) => {
                const section = data.sections[s.key];
                return (
                  <Tabs.Panel key={s.key} value={s.key}>
                    <Group justify="space-between" mb="sm">
                      <Text size="sm" c="dimmed">{s.hint}</Text>
                      <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} disabled={!section.rows.length} onClick={() => financeApi.gstr1Csv(period, s.key)}>
                        Download CSV
                      </Button>
                    </Group>
                    {section.rows.length === 0 ? (
                      <EmptyState title="Nothing in this section" description={`No ${s.label} supplies in ${dayjs(month).format('MMMM YYYY')}.`} />
                    ) : (
                      <ScrollArea>
                        <Table verticalSpacing="xs" fz="xs" miw={1000} striped withTableBorder>
                          <Table.Thead>
                            <Table.Tr>{section.headers.map((h) => <Table.Th key={h} style={{ whiteSpace: 'nowrap' }} ta={MONEY_COLS.has(h) ? 'right' : undefined}>{h}</Table.Th>)}</Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {section.rows.map((row, i) => (
                              <Table.Tr key={i}>
                                {section.headers.map((h) => (
                                  <Table.Td key={h} ta={MONEY_COLS.has(h) ? 'right' : undefined} style={{ whiteSpace: 'nowrap' }}>
                                    {MONEY_COLS.has(h) ? Number(row[h] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : row[h]}
                                  </Table.Td>
                                ))}
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    )}
                  </Tabs.Panel>
                );
              })}
            </Tabs>
          </Paper>
          <Text size="xs" c="dimmed">
            Draft and void invoices are excluded. Columns follow the GSTR-1 offline-tool CSV templates — review figures with your tax consultant before filing.
          </Text>
        </Stack>
      )}
    </>
  );
}
