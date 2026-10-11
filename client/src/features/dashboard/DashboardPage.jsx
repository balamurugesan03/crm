import {
  SimpleGrid, Paper, Title, Stack, Group, Text, Checkbox, Badge, Avatar, RingProgress, Progress, Button,
  Skeleton, ThemeIcon, Anchor, Grid,
} from '@mantine/core';
import { AreaChart, BarChart } from '@mantine/charts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconCoin, IconTrophy, IconUserPlus, IconTargetArrow, IconCalendarEvent, IconFlame, IconAlertTriangle,
  IconHeadset, IconUsers, IconArrowRight, IconVideo, IconPhone, IconHeartRateMonitor,
} from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { dashboardApi } from '../../api/dashboardApi.js';
import { tasksApi } from '../../api/tasksApi.js';
import { StatCard, percentChange } from '../../components/StatCard.jsx';
import { ActivityTimeline } from '../../components/ActivityTimeline.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { LeadScoreBadge } from '../leads/LeadScoreBadge.jsx';
import { HEALTH_STYLE } from '../deals/DealCard.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { formatCurrency } from '../../theme/theme.js';
import { useT } from '../../i18n/index.js';

function greeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t('dash.goodMorning', 'Good morning');
  if (h < 17) return t('dash.goodAfternoon', 'Good afternoon');
  return t('dash.goodEvening', 'Good evening');
}

function SectionCard({ title, action, children, ...rest }) {
  return (
    <Paper p="lg" shadow="xs" h="100%" {...rest}>
      <Group justify="space-between" mb="md">
        <Title order={4}>{title}</Title>
        {action}
      </Group>
      {children}
    </Paper>
  );
}

function SeeAll({ to }) {
  const t = useT();
  return (
    <Anchor component={Link} to={to} size="xs" fw={600}>
      <Group gap={2}>{t('dash.viewAll', 'View all')} <IconArrowRight size={12} /></Group>
    </Anchor>
  );
}

function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton h={48} w={320} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={128} radius="lg" />)}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 3 }}>
        <Skeleton h={340} radius="lg" style={{ gridColumn: 'span 2' }} />
        <Skeleton h={340} radius="lg" />
      </SimpleGrid>
    </Stack>
  );
}

const EVENT_ICON = { call: IconPhone, demo: IconVideo };

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-summary'], queryFn: dashboardApi.summary });

  const toggleTask = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const topValue = data.leaderboard[0]?.value || 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="sm" c="dimmed" fw={500}>{dayjs().format('dddd, D MMMM YYYY')}</Text>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>
            {greeting(t)}, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </Title>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconCalendarEvent size={16} />} onClick={() => navigate('/calendar')}>{t('dash.calendar', 'Calendar')}</Button>
          <Button leftSection={<IconTargetArrow size={16} />} onClick={() => navigate('/deals')}>{t('dash.openPipeline', 'Open pipeline')}</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        <StatCard
          label={t('dash.pipelineValue', 'Pipeline value')}
          value={formatCurrency(data.pipelineValue, { compact: true })}
          icon={IconCoin}
          color="indigo"
          hint={`${formatCurrency(data.weightedPipeline, { compact: true })} weighted · ${data.openDeals} deals`}
        />
        <StatCard
          label={t('dash.wonThisMonth', 'Won this month')}
          value={formatCurrency(data.wonThisMonth, { compact: true })}
          icon={IconTrophy}
          color="teal"
          delta={percentChange(data.wonThisMonth, data.wonLastMonth)}
          hint={t('dash.vsLastMonth', 'vs last month')}
        />
        <StatCard
          label={t('dash.newLeads', 'New leads')}
          value={data.leadsThisMonth}
          icon={IconUserPlus}
          color="grape"
          delta={percentChange(data.leadsThisMonth, data.leadsLastMonth)}
          hint={t('dash.thisMonth', 'this month')}
        />
        <StatCard
          label={t('dash.tasksDueToday', 'Tasks due today')}
          value={data.tasksDueToday}
          icon={IconAlertTriangle}
          color="orange"
          hint={data.overdueTasks ? `${data.overdueTasks} ${t('dash.overdue', 'overdue')}` : t('dash.nothingOverdue', 'Nothing overdue')}
        />
      </SimpleGrid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <SectionCard title={t('dash.revenueTrend', 'Revenue trend')} action={<Badge variant="light">{t('dash.last6Months', 'Last 6 months')}</Badge>}>
            <AreaChart
              h={280}
              data={data.revenueTrend}
              dataKey="month"
              series={[{ name: 'revenue', color: 'indigo.5', label: 'Won revenue' }]}
              curveType="monotone"
              gridAxis="y"
              withGradient
              fillOpacity={0.35}
              valueFormatter={(v) => formatCurrency(v, { compact: true })}
            />
          </SectionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard title={t('dash.winRate', 'Win rate')} action={<Badge variant="light" color="gray">90 days</Badge>}>
            <Group justify="center" my="xs">
              <RingProgress
                size={170}
                thickness={14}
                roundCaps
                sections={[{ value: data.winRate, color: data.winRate >= 50 ? 'teal' : 'orange' }]}
                label={
                  <Stack gap={0} align="center">
                    <Text fz={30} fw={800}>{data.winRate}%</Text>
                    <Text size="xs" c="dimmed">{t('dash.closedWon', 'closed won')}</Text>
                  </Stack>
                }
              />
            </Group>
            <SimpleGrid cols={3} mt="md" spacing="xs">
              {[
                { label: 'Contacts', value: data.contactsTotal, icon: IconUsers, color: 'blue' },
                { label: 'Open tickets', value: data.openTickets, icon: IconHeadset, color: 'red' },
                { label: 'Won (mo)', value: data.wonDealsThisMonth, icon: IconTrophy, color: 'teal' },
              ].map((s) => (
                <Paper key={s.label} p="xs" ta="center" bg="var(--app-subtle)" withBorder={false}>
                  <ThemeIcon variant="light" color={s.color} size="sm" mx="auto"><s.icon size={13} /></ThemeIcon>
                  <Text fw={700} mt={4}>{s.value}</Text>
                  <Text size="10px" c="dimmed" tt="uppercase" fw={600}>{s.label}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <SectionCard title={t('dash.pipelineByStage', 'Pipeline by stage')} action={<SeeAll to="/deals" />}>
            {data.pipelineByStage.length === 0 ? (
              <EmptyState title="No open deals yet" description="Deals you create will appear here grouped by stage." />
            ) : (
              <BarChart
                h={260}
                data={data.pipelineByStage}
                dataKey="stage"
                series={[{ name: 'value', color: 'violet.5', label: 'Pipeline value' }]}
                tickLine="y"
                gridAxis="y"
                barProps={{ radius: [6, 6, 0, 0] }}
                valueFormatter={(v) => formatCurrency(v, { compact: true })}
              />
            )}
          </SectionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard title={t('dash.topPerformers', 'Top performers')} action={<Badge variant="light" color="gray">Quarter</Badge>}>
            {data.leaderboard.length === 0 ? (
              <EmptyState title="No wins yet" description="Closed-won deals will rank your team here." />
            ) : (
              <Stack gap="md">
                {data.leaderboard.map((rep, i) => (
                  <div key={rep.userId}>
                    <Group justify="space-between" mb={6} wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Text fw={700} c="dimmed" w={14}>{i + 1}</Text>
                        <Avatar size={30} radius="xl" color={rep.avatarColor} variant="filled">{rep.name[0]}</Avatar>
                        <div>
                          <Text size="sm" fw={600}>{rep.name}</Text>
                          <Text size="xs" c="dimmed">{rep.count} deal{rep.count === 1 ? '' : 's'} won</Text>
                        </div>
                      </Group>
                      <Text size="sm" fw={700}>{formatCurrency(rep.value, { compact: true })}</Text>
                    </Group>
                    <Progress value={(rep.value / topValue) * 100} size="sm" radius="xl" color={i === 0 ? 'indigo' : 'gray'} />
                  </div>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
          <SectionCard title={<Group gap={6}><IconFlame size={18} color="var(--mantine-color-orange-6)" />{t('dash.hotLeads', 'Hot leads')}</Group>} action={<SeeAll to="/leads" />}>
            {data.hotLeads.length === 0 ? (
              <EmptyState title="No active leads" />
            ) : (
              <Stack gap="sm">
                {data.hotLeads.map((lead) => (
                  <Group key={lead._id} justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>{lead.name}</Text>
                      <Text size="xs" c="dimmed" tt="capitalize">{lead.source?.replace('_', ' ')} · {formatCurrency(lead.estimatedValue, { compact: true })}</Text>
                    </div>
                    <LeadScoreBadge score={lead.score} />
                  </Group>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
          <SectionCard title={t('dash.upcomingMeetings', 'Upcoming meetings')} action={<SeeAll to="/calendar" />}>
            {data.upcomingEvents.length === 0 ? (
              <EmptyState title="Nothing scheduled" description="Meetings you're invited to will show up here." />
            ) : (
              <Stack gap="sm">
                {data.upcomingEvents.map((ev) => {
                  const Icon = EVENT_ICON[ev.type] || IconCalendarEvent;
                  return (
                    <Group key={ev._id} wrap="nowrap" gap="sm">
                      <Paper w={46} p={4} ta="center" bg="var(--app-highlight)" withBorder={false}>
                        <Text size="10px" fw={700} c="indigo" tt="uppercase">{dayjs(ev.start).format('MMM')}</Text>
                        <Text fw={800} lh={1}>{dayjs(ev.start).format('D')}</Text>
                      </Paper>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={600} truncate>{ev.title}</Text>
                        <Group gap={4}>
                          <Icon size={12} color="var(--mantine-color-dimmed)" />
                          <Text size="xs" c="dimmed">{dayjs(ev.start).format('h:mm A')}{ev.location ? ` · ${ev.location}` : ''}</Text>
                        </Group>
                      </div>
                    </Group>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard title={t('dash.myTasks', 'My tasks')} action={<SeeAll to="/tasks" />}>
            {data.myTasks.length === 0 ? (
              <EmptyState title="Nothing pending" description="You're all caught up." />
            ) : (
              <Stack gap="sm">
                {data.myTasks.map((task) => {
                  const overdue = task.dueDate && dayjs(task.dueDate).isBefore(dayjs(), 'day');
                  return (
                    <Group key={task._id} justify="space-between" wrap="nowrap">
                      <Checkbox
                        label={<Text size="sm" lineClamp={1}>{task.title}</Text>}
                        checked={task.status === 'done'}
                        onChange={(e) => toggleTask.mutate({ id: task._id, status: e.currentTarget.checked ? 'done' : 'pending' })}
                      />
                      {task.dueDate && (
                        <Badge variant="light" color={overdue ? 'red' : 'gray'} size="sm" style={{ flexShrink: 0 }}>
                          {dayjs(task.dueDate).format('DD MMM')}
                        </Badge>
                      )}
                    </Group>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <SectionCard
            title={<Group gap={6}><IconHeartRateMonitor size={18} color="var(--mantine-color-red-6)" />{t('dash.needsAttention', 'Deals needing attention')}</Group>}
            action={
              <Group gap="xs">
                {data.atRiskDeals.length > 0 && (
                  <Badge variant="light" color="red">{formatCurrency(data.atRiskValue, { compact: true })} {t('dash.atRisk', 'at risk')}</Badge>
                )}
                <SeeAll to="/deals?health=at_risk" />
              </Group>
            }
          >
            {data.atRiskDeals.length === 0 ? (
              <EmptyState title="Pipeline is healthy" description="Every open deal has had recent activity. Nice work!" />
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {data.atRiskDeals.map((d) => {
                  const hs = HEALTH_STYLE[d.health.status];
                  return (
                    <Paper key={d._id} p="sm" withBorder style={{ borderLeft: `3px solid var(--mantine-color-${hs.color}-filled)` }}>
                      <Group justify="space-between" wrap="nowrap" mb={4}>
                        <Text size="sm" fw={600} truncate>{d.title}</Text>
                        <Text size="sm" fw={700}>{formatCurrency(d.amount, { compact: true })}</Text>
                      </Group>
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="xs" c="dimmed" truncate>{d.health.reasons[0]}</Text>
                        <Group gap={6} wrap="nowrap">
                          <Badge size="xs" variant="light" color={hs.color}>{hs.label}</Badge>
                          {d.owner && <Avatar size={18} radius="xl" color={d.owner.avatarColor}>{d.owner.name?.[0]}</Avatar>}
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={12}>
          <SectionCard title={t('dash.recentActivity', 'Recent activity')}>
            <ActivityTimeline items={data.recentActivity} />
          </SectionCard>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
