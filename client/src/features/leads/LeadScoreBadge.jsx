import { Badge, Tooltip } from '@mantine/core';
import { IconFlame, IconTemperature, IconSnowflake } from '@tabler/icons-react';

export function scoreBand(score = 0) {
  if (score >= 70) return { label: 'Hot', color: 'red', icon: IconFlame };
  if (score >= 40) return { label: 'Warm', color: 'orange', icon: IconTemperature };
  return { label: 'Cold', color: 'blue', icon: IconSnowflake };
}

export function LeadScoreBadge({ score = 0 }) {
  const band = scoreBand(score);
  return (
    <Tooltip label={`${band.label} lead — score based on source, contact details, value and status`}>
      <Badge variant="light" color={band.color} leftSection={<band.icon size={12} />} style={{ flexShrink: 0 }}>
        {score}
      </Badge>
    </Tooltip>
  );
}
