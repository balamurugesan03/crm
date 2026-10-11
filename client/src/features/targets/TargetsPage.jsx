import { useEffect, useState } from 'react';
import {
  Paper, Group, Stack, Text, Title, RingProgress, SimpleGrid, Table, Avatar, Progress, Button, NumberInput, Badge, Tooltip,
  Skeleton, ScrollArea, Box,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconPencil, IconDeviceFloppy, IconX, IconTarget, IconTrendingUp, IconCoin, IconCalendarStats } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/PageHeader.jsx';
import { api } from '../../api/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { formatCurrency } from '../../theme/theme.js';

const targetsApi = {
  get: (period) => api.get('/targets', { params: { period } }).then((r) => r.data),
  set: (payload) => api.put('/targets', payload).then((r) => r.data),
};

const compact = (n) => formatCurrency(n, { compact: true });
const attainColor = (pct) => (pct == null ? 'gray' : pct >= 100 ? 'teal' : pct >= 70 ? 'indigo' : pct >= 40 ? 'orange' : 'red');

function Kpi({ icon: Icon, label, value, hint, color }) {
  return (
    <Paper p="md">
      <Group gap="sm" wrap="nowrap">
        <Avatar color={color} variant="light" radius="md"><Icon size={18} /></Avatar>
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">{label}</Text>
          <Text fw={750} fz={20}>{value}</Text>
          {hint && <Text size="xs" c="dimmed">{hint}</Text>}
        </div>
      </Group>
    </Paper>
  );
}

export function TargetsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = ['owner', 'admin', 'manager'].includes(role);
  const [month, setMonth] = useState(dayjs().startOf('month').toDate());
  const period = dayjs(month).format('YYYY-MM');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ['targets', period], queryFn: () => targetsApi.get(period) });

  useEffect(() => {
    if (!data) return;
    setDraft({
      team: data.team.explicitTeamTarget ? data.team.target : '',
      ...Object.fromEntries(data.reps.map((r) => [r.userId, r.target])),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      targetsApi.set({
        period,
        targets: [
          ...data.reps.map((r) => ({ user: r.userId, amount: Number(draft[r.userId]) || 0 })),
          ...(draft.team !== '' && draft.team != null ? [{ user: null, amount: Number(draft.team) || 0 }] : []),
        ],
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(['targets', period], res);
      setEditing(false);
      notifications.show({ message: `Targets saved for ${dayjs(month).format('MMMM YYYY')}`, color: 'teal' });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not save targets', color: 'red' }),
  });

  const team = data?.team;
  const isCurrent = period === dayjs().format('YYYY-MM');

  return (
    <>
      <PageHeader
        title="Sales targets"
        subtitle="Monthly quotas, attainment and pace for every rep"
        action={
          <>
            <MonthPickerInput value={month} onChange={(v) => v && setMonth(v)} w={170} valueFormat="MMMM YYYY" leftSection={<IconCalendarStats size={16} />} />
            {canEdit && !editing && <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)} disabled={!data}>Set targets</Button>}
            {editing && (
              <>
                <Button variant="default" leftSection={<IconX size={16} />} onClick={() => setEditing(false)}>Cancel</Button>
                <Button leftSection={<IconDeviceFloppy size={16} />} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
              </>
            )}
          </>
        }
      />

      {isLoading || !data ? (
        <Stack><Skeleton h={180} radius="lg" /><Skeleton h={320} radius="lg" /></Stack>
      ) : (
        <Stack gap="lg">
          <Paper p="lg">
            <Group align="center" gap="xl" wrap="wrap">
              <RingProgress
                size={170}
                thickness={15}
                roundCaps
                sections={team.attainment ? [{ value: Math.min(100, team.attainment), color: attainColor(team.attainment) }] : []}
                label={
                  <Stack gap={0} align="center">
                    <Text fz={30} fw={800}>{team.attainment ?? '—'}{team.attainment != null && '%'}</Text>
                    <Text size="xs" c="dimmed">team attainment</Text>
                  </Stack>
                }
              />
              <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
                <Title order={3}>{compact(team.achieved)} <Text span c="dimmed" fz="lg" fw={500}>of {compact(team.target)} target</Text></Title>
                {isCurrent && (
                  <Box>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" c="dimmed">Month progress {data.elapsedPct}%</Text>
                      <Text size="xs" c="dimmed">Revenue progress {team.attainment ?? 0}%</Text>
                    </Group>
                    <Progress.Root size="lg" radius="xl">
                      <Progress.Section value={Math.min(100, team.attainment || 0)} color={attainColor(team.attainment)} />
                    </Progress.Root>
                    <Box style={{ position: 'relative', height: 0 }}>
                      <Tooltip label="Where you should be today">
                        <Box style={{ position: 'absolute', left: `${data.elapsedPct}%`, top: -18, width: 2, height: 18, background: 'var(--mantine-color-dark-3)' }} />
                      </Tooltip>
                    </Box>
                  </Box>
                )}
                {editing && (
                  <NumberInput
                    label="Team target (optional — defaults to the sum of rep targets)"
                    value={draft.team}
                    onChange={(v) => setDraft((d) => ({ ...d, team: v }))}
                    prefix="₹"
                    thousandSeparator=","
                    min={0}
                    maw={320}
                  />
                )}
              </Stack>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Kpi icon={IconCoin} label="Won so far" value={compact(team.achieved)} color="teal" hint={`${data.reps.reduce((s, r) => s + r.dealsWon, 0)} deals closed`} />
            <Kpi icon={IconTrendingUp} label="Projected at this pace" value={team.projected != null ? compact(team.projected) : '—'} color="indigo" hint={isCurrent ? 'Straight-line forecast to month end' : 'Past month'} />
            <Kpi icon={IconTarget} label="Weighted pipeline closing" value={compact(team.weightedPipeline)} color="grape" hint="Open deals expected to close this month" />
          </SimpleGrid>

          <Paper p={0} style={{ overflow: 'hidden' }}>
            <ScrollArea>
              <Table verticalSpacing="sm" horizontalSpacing="md" miw={820} highlightOnHover>
                <Table.Thead style={{ background: 'var(--app-subtle)' }}>
                  <Table.Tr>
                    <Table.Th>Rep</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>Won</Table.Th>
                    <Table.Th w={260}>Attainment</Table.Th>
                    <Table.Th>Projected</Table.Th>
                    <Table.Th>Pipeline (wtd.)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.reps.map((r) => (
                    <Table.Tr key={r.userId}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar size={30} radius="xl" color={r.avatarColor} variant="filled">{r.name[0]}</Avatar>
                          <div>
                            <Text size="sm" fw={600}>{r.name}</Text>
                            <Text size="xs" c="dimmed" tt="capitalize">{r.role.replace('_', ' ')}</Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {editing ? (
                          <NumberInput size="xs" w={140} prefix="₹" thousandSeparator="," min={0} value={draft[r.userId]} onChange={(v) => setDraft((d) => ({ ...d, [r.userId]: v }))} />
                        ) : (
                          <Text size="sm">{r.target ? compact(r.target) : '—'}</Text>
                        )}
                      </Table.Td>
                      <Table.Td><Text size="sm" fw={600}>{compact(r.achieved)}</Text><Text size="xs" c="dimmed">{r.dealsWon} deals</Text></Table.Td>
                      <Table.Td>
                        {r.attainment == null ? (
                          <Text size="xs" c="dimmed">No target set</Text>
                        ) : (
                          <Group gap="xs" wrap="nowrap">
                            <Progress value={Math.min(100, r.attainment)} color={attainColor(r.attainment)} size="md" radius="xl" style={{ flex: 1 }} />
                            <Badge variant="light" color={attainColor(r.attainment)} w={58}>{r.attainment}%</Badge>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {r.projected != null && r.target ? (
                          <Badge variant="dot" color={r.projected >= r.target ? 'teal' : 'orange'}>{compact(r.projected)}</Badge>
                        ) : <Text size="xs" c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td><Text size="sm">{compact(r.weightedPipeline)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Stack>
      )}
    </>
  );
}
