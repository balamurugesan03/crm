import { Stack, Text, ThemeIcon, Button } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';

export function EmptyState({ icon: Icon = IconInbox, title, description, actionLabel, onAction }) {
  return (
    <Stack align="center" gap={6} py={60}>
      <ThemeIcon size={48} radius="xl" variant="light" color="gray">
        <Icon size={24} />
      </ThemeIcon>
      <Text fw={600}>{title}</Text>
      {description && <Text c="dimmed" size="sm" ta="center" maw={320}>{description}</Text>}
      {actionLabel && (
        <Button variant="light" size="sm" mt="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
