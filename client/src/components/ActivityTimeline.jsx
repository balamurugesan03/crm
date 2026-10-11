import { Timeline, Text, Avatar, Group, ThemeIcon } from '@mantine/core';
import {
  IconNote, IconArrowsExchange, IconPlus, IconPencil, IconChecklist, IconPaperclip, IconBolt, IconCalendarEvent, IconFlag,
  IconMail, IconBrandWhatsapp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(relativeTime);

const TYPES = {
  note: { icon: IconNote, color: 'blue' },
  stage_change: { icon: IconArrowsExchange, color: 'violet' },
  status_change: { icon: IconFlag, color: 'orange' },
  created: { icon: IconPlus, color: 'teal' },
  updated: { icon: IconPencil, color: 'gray' },
  task: { icon: IconChecklist, color: 'cyan' },
  attachment: { icon: IconPaperclip, color: 'grape' },
  automation: { icon: IconBolt, color: 'yellow' },
  meeting: { icon: IconCalendarEvent, color: 'indigo' },
  email: { icon: IconMail, color: 'blue' },
  whatsapp: { icon: IconBrandWhatsapp, color: 'green' },
};

export function ActivityTimeline({ items = [] }) {
  if (items.length === 0) {
    return <Text c="dimmed" size="sm">No activity yet.</Text>;
  }

  return (
    <Timeline active={items.length} bulletSize={26} lineWidth={2} color="gray">
      {items.map((item) => {
        const { icon: Icon, color } = TYPES[item.type] || TYPES.note;
        return (
          <Timeline.Item
            key={item._id}
            bullet={
              <ThemeIcon size={26} radius="xl" variant="light" color={color}>
                <Icon size={14} />
              </ThemeIcon>
            }
            title={<Text size="sm" fw={500} style={{ whiteSpace: 'pre-wrap' }} lineClamp={4}>{item.body}</Text>}
          >
            <Group gap={6} mt={4}>
              <Avatar size={16} color={item.createdBy?.avatarColor || 'gray'} radius="xl">
                {item.createdBy?.name?.[0]}
              </Avatar>
              <Text size="xs" c="dimmed" title={dayjs(item.createdAt).format('DD MMM YYYY, h:mm A')}>
                {item.createdBy?.name || 'System'} · {dayjs(item.createdAt).fromNow()}
              </Text>
            </Group>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
