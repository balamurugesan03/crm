import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Group, Stack, Title, Text, Avatar, Paper, Tabs, Button, Textarea, Anchor, Center, Loader, Badge, UnstyledButton,
} from '@mantine/core';
import { IconArrowLeft, IconWorld, IconPhone, IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { companiesApi } from '../../api/companiesApi.js';
import { ActivityTimeline } from '../../components/ActivityTimeline.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { RelatedTasksPanel } from '../../components/RelatedTasksPanel.jsx';
import { AiInsightsPanel } from '../ai/AiInsightsPanel.jsx';
import { CustomFieldValues } from '../../components/CustomFields.jsx';
import { MessagesPanel } from '../messaging/MessagesPanel.jsx';
import { AttachmentsPanel } from '../../components/AttachmentsPanel.jsx';
import { CompanyFormDrawer } from './CompanyFormDrawer.jsx';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

export function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['companies', id],
    queryFn: () => companiesApi.get(id),
  });

  const addNote = useMutation({
    mutationFn: (body) => companiesApi.addNote(id, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['companies', id] });
      notifications.show({ message: 'Note added', color: 'teal' });
    },
  });

  if (isLoading || !company) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/companies" size="sm" c="dimmed">
        <Group gap={4}><IconArrowLeft size={14} /> Back to companies</Group>
      </Anchor>

      <Paper p="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <Avatar size={56} radius="xl" color="indigo">{company.name?.[0]}</Avatar>
            <div>
              <Title order={3}>{company.name}</Title>
              <Text c="dimmed" size="sm">{company.industry}</Text>
              <Group gap="lg" mt={8}>
                {company.domain && (
                  <Group gap={4}><IconWorld size={14} /><Text size="sm">{company.domain}</Text></Group>
                )}
                {company.phone && (
                  <Group gap={4}><IconPhone size={14} /><Text size="sm">{company.phone}</Text></Group>
                )}
              </Group>
            </div>
          </Group>
          <Button variant="light" leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </Group>
        <Stack gap={6} mt="md" maw={520}>
          {company.gstin && <Group justify="space-between"><Text c="dimmed" size="sm">GSTIN</Text><Text size="sm" fw={600}>{company.gstin}</Text></Group>}
          <CustomFieldValues entity="Company" values={company.customFields} />
        </Stack>
      </Paper>

      <Tabs defaultValue="activity">
        <Tabs.List>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts ({company.contacts.length})</Tabs.Tab>
          <Tabs.Tab value="deals">Deals ({company.deals.length})</Tabs.Tab>
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
          <Tabs.Tab value="messages">Messages</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
          <Tabs.Tab value="ai" color="grape">✨ AI insights</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="activity" pt="md">
          <Paper p="lg">
            <Stack gap="sm" mb="lg">
              <Textarea
                placeholder="Log a note about this company..."
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button size="xs" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate(note)}>
                  Add note
                </Button>
              </Group>
            </Stack>
            <ActivityTimeline items={company.activity} />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="contacts" pt="md">
          <Paper p={0}>
            {company.contacts.length === 0 ? (
              <EmptyState title="No contacts linked" description="Contacts you add for this company will show up here." />
            ) : (
              <Stack gap={0}>
                {company.contacts.map((c) => (
                  <UnstyledButton
                    key={c._id}
                    p="md"
                    onClick={() => navigate(`/contacts/${c._id}`)}
                    style={{ borderBottom: '1px solid var(--app-border)' }}
                  >
                    <Group justify="space-between">
                      <Group gap={8}>
                        <Avatar size={28} radius="xl" color="indigo">{c.firstName?.[0]}</Avatar>
                        <Text size="sm" fw={500}>{c.firstName} {c.lastName}</Text>
                      </Group>
                      <Text size="sm" c="dimmed">{c.email}</Text>
                    </Group>
                  </UnstyledButton>
                ))}
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="deals" pt="md">
          <Paper p={0}>
            {company.deals.length === 0 ? (
              <EmptyState title="No deals linked" description="Deals for this company will show up here." />
            ) : (
              <Stack gap={0}>
                {company.deals.map((d) => (
                  <Group key={d._id} justify="space-between" p="md" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <Text size="sm" fw={500}>{d.title}</Text>
                    <Group gap="md">
                      <Badge variant="light" color={d.stage?.isWon ? 'teal' : d.stage?.isLost ? 'red' : 'indigo'}>
                        {d.stage?.name}
                      </Badge>
                      <Text size="sm">{formatCurrency(d.amount)}</Text>
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="tasks" pt="md">
          <Paper p="lg">
            <RelatedTasksPanel relatedToModel="Company" relatedToId={company._id} relatedToLabel={company.name} />
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="ai" pt="md">
          <AiInsightsPanel entityType="Company" entityId={company._id} phone={company.phone} />
        </Tabs.Panel>
        <Tabs.Panel value="messages" pt="md">
          <Paper p="lg"><MessagesPanel entityType="Company" entityId={company._id} phone={company.phone} /></Paper>
        </Tabs.Panel>
        <Tabs.Panel value="files" pt="md">
          <Paper p="lg"><AttachmentsPanel entityType="Company" entityId={company._id} /></Paper>
        </Tabs.Panel>
      </Tabs>

      <CompanyFormDrawer opened={editing} onClose={() => setEditing(false)} company={company} />
    </Stack>
  );
}
