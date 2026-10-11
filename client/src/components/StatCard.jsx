import { Paper, Group, Text, ThemeIcon, Badge } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';

// `delta` is a % change vs. the previous period; omit it to hide the trend badge.
export function StatCard({ label, value, icon: Icon, color = 'indigo', delta, hint }) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && delta >= 0;

  return (
    <Paper p="lg" className="hover-lift" shadow="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.05em' }}>{label}</Text>
          <Text fz={26} fw={750} mt={6} style={{ letterSpacing: '-0.02em' }} truncate>{value}</Text>
        </div>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>
          <Icon size={22} stroke={1.8} />
        </ThemeIcon>
      </Group>
      {(hasDelta || hint) && (
        <Group gap={6} mt="sm">
          {hasDelta && (
            <Badge
              size="sm"
              variant="light"
              color={positive ? 'teal' : 'red'}
              leftSection={positive ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
            >
              {Math.abs(delta)}%
            </Badge>
          )}
          {hint && <Text size="xs" c="dimmed">{hint}</Text>}
        </Group>
      )}
    </Paper>
  );
}

export function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
