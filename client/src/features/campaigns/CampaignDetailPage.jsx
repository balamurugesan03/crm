import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Group, Stack, Title, Text, Paper, Button, Anchor, Center, Loader, Badge, ThemeIcon } from '@mantine/core';
import { IconArrowLeft, IconPencil, IconSpeakerphone } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { campaignsApi } from '../../api/campaignsApi.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { CampaignFormDrawer } from './CampaignFormDrawer.jsx';

const STATUS_COLORS = { planned: 'gray', active: 'teal', paused: 'orange', completed: 'indigo' };
const LEAD_STATUS_COLORS = { new: 'blue', contacted: 'grape', qualified: 'teal', unqualified: 'gray', converted: 'green' };

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

export function CampaignDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => campaignsApi.get(id),
  });

  if (isLoading || !campaign) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/campaigns" size="sm" c="dimmed">
        <Group gap={4}><IconArrowLeft size={14} /> Back to campaigns</Group>
      </Anchor>

      <Paper p="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <ThemeIcon size={48} radius="xl" variant="light" color="indigo">
              <IconSpeakerphone size={22} />
            </ThemeIcon>
            <div>
              <Group gap={8}>
                <Title order={3}>{campaign.name}</Title>
                <Badge color={STATUS_COLORS[campaign.status]} variant="light" tt="capitalize">{campaign.status}</Badge>
              </Group>
              <Text c="dimmed" size="sm">
                {campaign.startDate ? dayjs(campaign.startDate).format('DD MMM YYYY') : 'No start date'}
                {campaign.endDate ? ` — ${dayjs(campaign.endDate).format('DD MMM YYYY')}` : ''}
                {campaign.budget ? ` · Budget ${formatCurrency(campaign.budget)}` : ''}
              </Text>
              {campaign.description && <Text size="sm" mt={8} maw={500}>{campaign.description}</Text>}
            </div>
          </Group>
          <Button variant="light" leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </Group>
      </Paper>

      <Paper p="lg">
        <Title order={4} mb="md">Leads from this campaign ({campaign.leads.length})</Title>
        {campaign.leads.length === 0 ? (
          <EmptyState
            title="No leads yet"
            description="Link leads to this campaign from the lead's edit form to track it here."
          />
        ) : (
          <Stack gap={0}>
            {campaign.leads.map((lead) => (
              <Group key={lead._id} justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <Text size="sm" fw={500}>{lead.name}</Text>
                <Group gap="md">
                  <Text size="sm" c="dimmed">{lead.email || '—'}</Text>
                  <Badge color={LEAD_STATUS_COLORS[lead.status]} variant="light" tt="capitalize">{lead.status}</Badge>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>

      <CampaignFormDrawer opened={editing} onClose={() => setEditing(false)} campaign={campaign} />
    </Stack>
  );
}
