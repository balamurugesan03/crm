import { SimpleGrid, Paper, Title, Stack, Center, Loader } from '@mantine/core';
import { BarChart, DonutChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { IconBuildingSkyscraper, IconUsers, IconCoin, IconTrendingUp } from '@tabler/icons-react';

import { PageHeader } from '../../components/PageHeader.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { adminApi } from '../../api/adminApi.js';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

const PLAN_COLORS = { trial: 'gray.6', starter: 'blue.6', pro: 'indigo.6', enterprise: 'grape.6' };

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats });

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader color="dark" />
      </Center>
    );
  }

  const planData = data.planBreakdown.map((p) => ({
    name: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    value: p.count,
    color: PLAN_COLORS[p.plan] || 'gray.6',
  }));

  return (
    <Stack gap="lg">
      <PageHeader title="Platform Overview" subtitle="Stats across every organization on NexusCRM" />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard label="Organizations" value={data.totalOrganizations} icon={IconBuildingSkyscraper} color="dark" />
        <StatCard label="Total users" value={data.totalUsers} icon={IconUsers} color="indigo" />
        <StatCard label="Paid revenue" value={formatCurrency(data.totalRevenue)} icon={IconCoin} color="teal" />
        <StatCard label="New orgs this month" value={data.orgsThisMonth} icon={IconTrendingUp} color="grape" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Paper p="lg" style={{ gridColumn: 'span 2' }}>
          <Title order={4} mb="md">Signups (last 6 months)</Title>
          <BarChart
            h={260}
            data={data.signupTrend}
            dataKey="month"
            series={[{ name: 'signups', color: 'dark.4', label: 'New organizations' }]}
            tickLine="y"
            gridAxis="y"
          />
        </Paper>

        <Paper p="lg">
          <Title order={4} mb="md">Plans</Title>
          {planData.length === 0 ? (
            <EmptyState title="No organizations yet" />
          ) : (
            <Center>
              <DonutChart h={220} data={planData} withLabelsLine withLabels />
            </Center>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
