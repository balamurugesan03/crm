import { SimpleGrid, Paper, Title, Stack, Center, Loader } from '@mantine/core';
import { LineChart, BarChart, DonutChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { IconCoin, IconClockDollar } from '@tabler/icons-react';

import { PageHeader } from '../../components/PageHeader.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { reportsApi } from '../../api/reportsApi.js';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

const SOURCE_LABELS = {
  website: 'Website',
  referral: 'Referral',
  social: 'Social',
  event: 'Event',
  cold_call: 'Cold call',
  advertisement: 'Advertisement',
  other: 'Other',
};

const DONUT_COLORS = ['indigo.6', 'teal.6', 'grape.6', 'orange.6', 'blue.6', 'red.6', 'gray.6'];

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['reports'], queryFn: reportsApi.get });

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    );
  }

  const leadsBySourceData = data.leadsBySource.map((r, i) => ({
    name: SOURCE_LABELS[r.source] || r.source,
    value: r.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const hasRevenue = data.revenueTrend.some((r) => r.revenue > 0);
  const hasLeadSources = leadsBySourceData.length > 0;

  return (
    <Stack gap="lg">
      <PageHeader title="Reports" subtitle="Revenue, pipeline and lead performance" />

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatCard label="Paid revenue" value={formatCurrency(data.invoiceStats.paid.total)} icon={IconCoin} color="teal" />
        <StatCard
          label="Outstanding (sent + overdue)"
          value={formatCurrency(data.invoiceStats.sent.total + data.invoiceStats.overdue.total)}
          icon={IconClockDollar}
          color="orange"
        />
      </SimpleGrid>

      <Paper p="lg">
        <Title order={4} mb="md">Revenue trend (won deals, last 6 months)</Title>
        {hasRevenue ? (
          <LineChart
            h={260}
            data={data.revenueTrend}
            dataKey="month"
            series={[{ name: 'revenue', color: 'indigo.6', label: 'Revenue' }]}
            curveType="monotone"
            valueFormatter={(v) => formatCurrency(v)}
          />
        ) : (
          <EmptyState title="No won deals yet" description="Revenue from won deals will appear here month by month." />
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper p="lg">
          <Title order={4} mb="md">Sales funnel (leads by status)</Title>
          <BarChart
            h={240}
            data={data.leadFunnel.map((f) => ({ status: f.status.charAt(0).toUpperCase() + f.status.slice(1), count: f.count }))}
            dataKey="status"
            series={[{ name: 'count', color: 'indigo.6', label: 'Leads' }]}
            tickLine="y"
            gridAxis="y"
          />
        </Paper>

        <Paper p="lg">
          <Title order={4} mb="md">Leads by source</Title>
          {hasLeadSources ? (
            <Center>
              <DonutChart h={240} data={leadsBySourceData} withLabelsLine withLabels />
            </Center>
          ) : (
            <EmptyState title="No leads yet" description="Lead source breakdown will appear here once you add leads." />
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
