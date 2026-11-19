import { SimpleGrid, Paper, Title, Stack, Center, Loader, Group, Text, Badge } from '@mantine/core';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { BarChart, DonutChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { IconBuildingSkyscraper, IconUsers, IconCoin, IconTrendingUp } from '@tabler/icons-react';

import { PageHeader } from '../components/PageHeader.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { adminApi, formatINR as formatCurrency, STATUS_COLORS } from '../api/adminApi.js';

const PLAN_COLORS = { trial: 'gray.6', starter: 'blue.6', pro: 'indigo.6', enterprise: 'grape.6' };
const EXTRA_COLORS = ['teal.6', 'orange.6', 'cyan.6', 'pink.6', 'lime.6', 'red.6'];

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats });

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader color="dark" />
      </Center>
    );
  }

  const planData = data.planBreakdown.map((p, i) => ({
    name: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
    value: p.count,
    color: PLAN_COLORS[p.plan] || EXTRA_COLORS[i % EXTRA_COLORS.length],
  }));

  return (
    <Stack gap="lg">
      <PageHeader title="Platform Overview" subtitle="Stats across every organization on the platform" />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard label="Organizations" value={data.totalOrganizations} icon={IconBuildingSkyscraper} color="dark" />
        <StatCard label="Total users" value={data.totalUsers} icon={IconUsers} color="indigo" />
        <StatCard label="Subscription revenue" value={formatCurrency(data.totalRevenue)} hint={`${formatCurrency(data.revenueThisMonth)} this month`} icon={IconCoin} color="teal" />
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

      <Paper p="lg">
        <Title order={4} mb="md">Renewals due (next 14 days) and expired</Title>
        {data.expiringSoon.length === 0 ? (
          <Text size="sm" c="dimmed">Nothing due. Lifetime and open-ended workspaces never appear here.</Text>
        ) : (
          <Stack gap={0}>
            {data.expiringSoon.map((o) => (
              <Group key={o._id} justify="space-between" py="xs" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <Text component={Link} to={`/organizations/${o._id}`} fw={500} size="sm">{o.name}</Text>
                <Group gap="sm">
                  <Badge variant="light" tt="capitalize">{o.plan}</Badge>
                  <Badge color={STATUS_COLORS[o.subscriptionStatus]} variant="light" tt="capitalize">{o.subscriptionStatus.replace('_', ' ')}</Badge>
                  <Text size="sm" c={dayjs(o.currentPeriodEnd).isBefore(dayjs()) ? 'red' : undefined}>
                    {dayjs(o.currentPeriodEnd).format('DD MMM YYYY')}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
