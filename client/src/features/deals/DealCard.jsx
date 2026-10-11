import { Draggable } from '@hello-pangea/dnd';
import { Paper, Text, Group, Avatar, Badge, Tooltip } from '@mantine/core';
import { IconClockExclamation, IconFlame } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { formatCurrency } from '../../theme/theme.js';

export const HEALTH_STYLE = {
  healthy: { color: 'teal', label: 'Healthy' },
  warning: { color: 'orange', label: 'Needs attention' },
  rotting: { color: 'red', label: 'Rotting' },
};

export function DealCard({ deal, index, onClick }) {
  const health = deal.health;
  const style = HEALTH_STYLE[health?.status];
  const flagged = health && health.status !== 'healthy';

  return (
    <Draggable draggableId={deal._id} index={index}>
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          p="sm"
          mb="sm"
          shadow={snapshot.isDragging ? 'md' : 'xs'}
          onClick={() => onClick(deal)}
          style={{
            cursor: 'pointer',
            opacity: snapshot.isDragging ? 0.9 : 1,
            borderLeft: style ? `3px solid var(--mantine-color-${style.color}-filled)` : undefined,
            ...provided.draggableProps.style,
          }}
        >
          <Text fw={600} size="sm" mb={4} lineClamp={2}>{deal.title}</Text>
          <Text fw={700} size="sm" c="indigo" mb={8}>{formatCurrency(deal.amount)}</Text>
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" truncate>
              {deal.company?.name || (deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName || ''}` : '—')}
            </Text>
            {deal.ownerUser && (
              <Tooltip label={deal.ownerUser.name}>
                <Avatar size={20} radius="xl" color={deal.ownerUser.avatarColor || 'indigo'}>
                  {deal.ownerUser.name?.[0]}
                </Avatar>
              </Tooltip>
            )}
          </Group>
          <Group gap={6} mt={8}>
            {deal.expectedCloseDate && (
              <Badge
                variant="light"
                color={dayjs(deal.expectedCloseDate).isBefore(dayjs(), 'day') ? 'red' : 'gray'}
                size="xs"
              >
                {dayjs(deal.expectedCloseDate).format('DD MMM')}
              </Badge>
            )}
            {flagged && (
              <Tooltip label={health.reasons.join(' · ')} multiline w={220}>
                <Badge
                  variant="light"
                  color={style.color}
                  size="xs"
                  leftSection={health.status === 'rotting' ? <IconFlame size={10} /> : <IconClockExclamation size={10} />}
                >
                  {health.daysIdle}d idle
                </Badge>
              </Tooltip>
            )}
          </Group>
        </Paper>
      )}
    </Draggable>
  );
}
