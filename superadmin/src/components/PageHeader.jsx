import { Group, Stack, Title, Text } from '@mantine/core';

export function PageHeader({ title, subtitle, action }) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" gap="sm">
      <Stack gap={4}>
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>{title}</Title>
        {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
      </Stack>
      {action && <Group gap="xs">{action}</Group>}
    </Group>
  );
}
