import { useMemo, useState } from 'react';
import {
  Group, Button, ActionIcon, Title, Paper, Text, Stack, Badge, SegmentedControl, Grid, Box, ThemeIcon, Avatar, Tooltip,
} from '@mantine/core';
import {
  IconChevronLeft, IconChevronRight, IconPlus, IconCalendarEvent, IconChecklist, IconMapPin, IconClock,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { eventsApi } from '../../api/eventsApi.js';
import { EventFormDrawer, EVENT_TYPES } from './EventFormDrawer.jsx';
import { useOpenOnNewParam } from '../../hooks/useOpenOnNewParam.js';
import { EmptyState } from '../../components/EmptyState.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPE_COLOR = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.color]));
const MAX_CHIPS = 3;

function buildGrid(month) {
  const first = month.startOf('month');
  const offset = (first.day() + 6) % 7; // Monday-first
  const start = first.subtract(offset, 'day');
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
}

function chipStyle(color) {
  return {
    background: `var(--mantine-color-${color}-light)`,
    color: `var(--mantine-color-${color}-light-color)`,
    borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
  };
}

export function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [selected, setSelected] = useState(dayjs());
  const [scope, setScope] = useState('all');
  const [drawer, setDrawer] = useState({ opened: false, event: null, defaultStart: null });

  const grid = useMemo(() => buildGrid(month), [month]);
  const range = { from: grid[0].startOf('day').toISOString(), to: grid[41].endOf('day').toISOString() };

  const { data, isFetching } = useQuery({
    queryKey: ['events', range.from, scope],
    queryFn: () => eventsApi.list({ ...range, mine: scope === 'mine' }),
    placeholderData: (prev) => prev,
  });

  const byDay = useMemo(() => {
    const map = {};
    (data?.events || []).forEach((e) => {
      const key = dayjs(e.start).format('YYYY-MM-DD');
      (map[key] ||= []).push({ kind: 'event', ...e });
    });
    (data?.tasks || []).forEach((t) => {
      const key = dayjs(t.dueDate).format('YYYY-MM-DD');
      (map[key] ||= []).push({ kind: 'task', ...t });
    });
    Object.values(map).forEach((items) =>
      items.sort((a, b) => new Date(a.start || a.dueDate) - new Date(b.start || b.dueDate)),
    );
    return map;
  }, [data]);

  function openCreate(day) {
    const base = (day || selected).hour(10).minute(0).second(0);
    setDrawer({ opened: true, event: null, defaultStart: base.toDate() });
  }

  useOpenOnNewParam(() => openCreate(dayjs()));

  function openItem(item) {
    if (item.kind === 'task') navigate('/tasks');
    else setDrawer({ opened: true, event: item, defaultStart: null });
  }

  const selectedItems = byDay[selected.format('YYYY-MM-DD')] || [];
  const monthEventCount = (data?.events || []).filter((e) => dayjs(e.start).isSame(month, 'month')).length;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>Calendar</Title>
          <Text c="dimmed" size="sm">Meetings, calls and task due dates in one view</Text>
        </div>
        <Group gap="xs">
          <SegmentedControl value={scope} onChange={setScope} data={[{ value: 'all', label: 'Team' }, { value: 'mine', label: 'Mine' }]} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => openCreate()}>New event</Button>
        </Group>
      </Group>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Paper p={0} shadow="xs" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--app-border)' }}>
              <Group gap="xs">
                <ActionIcon variant="default" onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="Previous month">
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <ActionIcon variant="default" onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="Next month">
                  <IconChevronRight size={16} />
                </ActionIcon>
                <Title order={4} ml="xs">{month.format('MMMM YYYY')}</Title>
                {isFetching && <Badge variant="dot" color="gray" size="sm">Syncing</Badge>}
              </Group>
              <Group gap="xs">
                <Badge variant="light" color="gray">{monthEventCount} events</Badge>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => {
                    setMonth(dayjs().startOf('month'));
                    setSelected(dayjs());
                  }}
                >
                  Today
                </Button>
              </Group>
            </Group>

            <div className="cal-grid" style={{ borderLeft: '1px solid var(--app-border)' }}>
              {WEEKDAYS.map((d) => (
                <Text key={d} size="xs" fw={700} c="dimmed" tt="uppercase" ta="center" py={8}
                  style={{ borderRight: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)', background: 'var(--app-subtle)' }}>
                  {d}
                </Text>
              ))}
              {grid.map((day) => {
                const key = day.format('YYYY-MM-DD');
                const items = byDay[key] || [];
                const isToday = day.isSame(dayjs(), 'day');
                const isSelected = day.isSame(selected, 'day');
                return (
                  <div
                    key={key}
                    className="cal-cell"
                    data-outside={!day.isSame(month, 'month')}
                    style={isSelected ? { background: 'var(--app-highlight)' } : undefined}
                    onClick={() => setSelected(day)}
                    onDoubleClick={() => openCreate(day)}
                  >
                    <Group justify="space-between" gap={4}>
                      <Box
                        w={24}
                        h={24}
                        style={{
                          borderRadius: 99,
                          display: 'grid',
                          placeItems: 'center',
                          background: isToday ? 'var(--mantine-color-indigo-filled)' : 'transparent',
                          color: isToday ? 'white' : undefined,
                        }}
                      >
                        <Text size="xs" fw={isToday ? 700 : 500}>{day.date()}</Text>
                      </Box>
                    </Group>
                    {items.slice(0, MAX_CHIPS).map((item) => (
                      <span
                        key={item._id}
                        className="cal-chip"
                        style={chipStyle(item.kind === 'task' ? (item.status === 'done' ? 'gray' : 'cyan') : TYPE_COLOR[item.type] || 'indigo')}
                        onClick={(e) => {
                          e.stopPropagation();
                          openItem(item);
                        }}
                        title={item.title}
                      >
                        {item.kind === 'event' ? `${dayjs(item.start).format('h:mma')} ${item.title}` : `✓ ${item.title}`}
                      </span>
                    ))}
                    {items.length > MAX_CHIPS && (
                      <Text size="10px" c="dimmed" fw={600} mt={2}>+{items.length - MAX_CHIPS} more</Text>
                    )}
                  </div>
                );
              })}
            </div>
          </Paper>
          <Text size="xs" c="dimmed" mt={6}>Tip: double-click a day to schedule an event on it.</Text>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Paper p="lg" shadow="xs">
            <Group justify="space-between" mb="md">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">{selected.format('dddd')}</Text>
                <Title order={3}>{selected.format('D MMMM')}</Title>
              </div>
              <Tooltip label="Add event on this day">
                <ActionIcon variant="light" size="lg" onClick={() => openCreate(selected)}><IconPlus size={18} /></ActionIcon>
              </Tooltip>
            </Group>

            {selectedItems.length === 0 ? (
              <EmptyState icon={IconCalendarEvent} title="Free day" description="No meetings or tasks due." />
            ) : (
              <Stack gap="sm">
                {selectedItems.map((item) => {
                  const color = item.kind === 'task' ? 'cyan' : TYPE_COLOR[item.type] || 'indigo';
                  return (
                    <Paper
                      key={item._id}
                      p="sm"
                      withBorder
                      className="hover-lift"
                      style={{ cursor: 'pointer', borderLeft: `4px solid var(--mantine-color-${color}-filled)` }}
                      onClick={() => openItem(item)}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} lineClamp={2} td={item.status === 'cancelled' ? 'line-through' : undefined}>{item.title}</Text>
                          {item.kind === 'event' ? (
                            <Stack gap={2} mt={4}>
                              <Group gap={4}><IconClock size={12} /><Text size="xs" c="dimmed">{dayjs(item.start).format('h:mm A')} – {dayjs(item.end).format('h:mm A')}</Text></Group>
                              {item.location && <Group gap={4}><IconMapPin size={12} /><Text size="xs" c="dimmed">{item.location}</Text></Group>}
                            </Stack>
                          ) : (
                            <Text size="xs" c="dimmed" mt={4}>Task · {item.priority} priority</Text>
                          )}
                        </div>
                        <ThemeIcon size="sm" variant="light" color={color}>
                          {item.kind === 'task' ? <IconChecklist size={12} /> : <IconCalendarEvent size={12} />}
                        </ThemeIcon>
                      </Group>
                      {item.kind === 'event' && item.attendees?.length > 0 && (
                        <Avatar.Group mt={8} spacing="xs">
                          {item.attendees.slice(0, 4).map((a) => (
                            <Tooltip key={a._id} label={a.name}>
                              <Avatar size={22} radius="xl" color={a.avatarColor}>{a.name?.[0]}</Avatar>
                            </Tooltip>
                          ))}
                        </Avatar.Group>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            )}

            <Group gap={6} mt="lg">
              {EVENT_TYPES.slice(0, 4).map((t) => (
                <Badge key={t.value} variant="dot" color={t.color} size="sm">{t.label}</Badge>
              ))}
              <Badge variant="dot" color="cyan" size="sm">Task</Badge>
            </Group>
          </Paper>
        </Grid.Col>
      </Grid>

      <EventFormDrawer
        opened={drawer.opened}
        onClose={() => setDrawer((d) => ({ ...d, opened: false }))}
        event={drawer.event}
        defaultStart={drawer.defaultStart}
      />
    </Stack>
  );
}
