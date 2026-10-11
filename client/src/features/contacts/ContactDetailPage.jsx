import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Group, Stack, Title, Text, Avatar, Paper, Tabs, Button, Textarea, Badge, Anchor, Center, Loader,
} from '@mantine/core';
import { IconArrowLeft, IconMail, IconPhone, IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { contactsApi } from '../../api/contactsApi.js';
import { ActivityTimeline } from '../../components/ActivityTimeline.jsx';
import { RelatedTasksPanel } from '../../components/RelatedTasksPanel.jsx';
import { AiInsightsPanel } from '../ai/AiInsightsPanel.jsx';
import { CustomFieldValues } from '../../components/CustomFields.jsx';
import { PortalLinkButton } from '../portal/PortalLinkButton.jsx';
import { MessagesPanel } from '../messaging/MessagesPanel.jsx';
import { AttachmentsPanel } from '../../components/AttachmentsPanel.jsx';
import { ContactFormDrawer } from './ContactFormDrawer.jsx';

export function ContactDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => contactsApi.get(id),
  });

  const addNote = useMutation({
    mutationFn: (body) => contactsApi.addNote(id, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      notifications.show({ message: 'Note added', color: 'teal' });
    },
  });

  if (isLoading || !contact) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/contacts" size="sm" c="dimmed">
        <Group gap={4}><IconArrowLeft size={14} /> Back to contacts</Group>
      </Anchor>

      <Paper p="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <Avatar size={56} radius="xl" color="indigo">{contact.firstName?.[0]}</Avatar>
            <div>
              <Title order={3}>{contact.firstName} {contact.lastName}</Title>
              <Text c="dimmed" size="sm">{contact.jobTitle}{contact.company ? ` at ${contact.company.name}` : ''}</Text>
              <Group gap="lg" mt={8}>
                {contact.email && (
                  <Group gap={4}><IconMail size={14} /><Text size="sm">{contact.email}</Text></Group>
                )}
                {contact.phone && (
                  <Group gap={4}><IconPhone size={14} /><Text size="sm">{contact.phone}</Text></Group>
                )}
              </Group>
              {contact.tags?.length > 0 && (
                <Group gap={6} mt={8}>
                  {contact.tags.map((tag) => <Badge key={tag} variant="light">{tag}</Badge>)}
                </Group>
              )}
            </div>
          </Group>
          <Group gap="xs">
            <PortalLinkButton contact={contact} />
            <Button variant="light" leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </Group>
        </Group>
      </Paper>

      <Tabs defaultValue="activity" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
          <Tabs.Tab value="messages">Messages</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
          <Tabs.Tab value="ai" color="grape">✨ AI insights</Tabs.Tab>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="activity" pt="md">
          <Paper p="lg">
            <Stack gap="sm" mb="lg">
              <Textarea
                placeholder="Log a note about this contact..."
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button
                  size="xs"
                  disabled={!note.trim()}
                  loading={addNote.isPending}
                  onClick={() => addNote.mutate(note)}
                >
                  Add note
                </Button>
              </Group>
            </Stack>
            <ActivityTimeline items={contact.activity} />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="tasks" pt="md">
          <Paper p="lg">
            <RelatedTasksPanel
              relatedToModel="Contact"
              relatedToId={contact._id}
              relatedToLabel={`${contact.firstName} ${contact.lastName || ''}`.trim()}
            />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="ai" pt="md">
          <AiInsightsPanel entityType="Contact" entityId={contact._id} email={contact.email} phone={contact.phone} />
        </Tabs.Panel>

        <Tabs.Panel value="messages" pt="md">
          <Paper p="lg"><MessagesPanel entityType="Contact" entityId={contact._id} email={contact.email} phone={contact.phone} /></Paper>
        </Tabs.Panel>

        <Tabs.Panel value="files" pt="md">
          <Paper p="lg"><AttachmentsPanel entityType="Contact" entityId={contact._id} /></Paper>
        </Tabs.Panel>

        <Tabs.Panel value="overview" pt="md">
          <Paper p="lg">
            <Stack gap={8}>
              <Group justify="space-between"><Text c="dimmed" size="sm">Email</Text><Text size="sm">{contact.email || '—'}</Text></Group>
              <Group justify="space-between"><Text c="dimmed" size="sm">Phone</Text><Text size="sm">{contact.phone || '—'}</Text></Group>
              <Group justify="space-between"><Text c="dimmed" size="sm">Company</Text><Text size="sm">{contact.company?.name || '—'}</Text></Group>
              <Group justify="space-between"><Text c="dimmed" size="sm">Job title</Text><Text size="sm">{contact.jobTitle || '—'}</Text></Group>
              <Group justify="space-between"><Text c="dimmed" size="sm">Owner</Text><Text size="sm">{contact.ownerUser?.name || '—'}</Text></Group>
              <CustomFieldValues entity="Contact" values={contact.customFields} />
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <ContactFormDrawer opened={editing} onClose={() => setEditing(false)} contact={contact} />
    </Stack>
  );
}
