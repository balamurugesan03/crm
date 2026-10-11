import { useState } from 'react';
import {
  Stack, Group, SegmentedControl, TextInput, Textarea, Select, Button, Paper, Text, Badge, Avatar, Alert, Tooltip, Divider,
} from '@mantine/core';
import { IconSend, IconMail, IconBrandWhatsapp, IconSparkles, IconExternalLink, IconInfoCircle } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

import { messagingApi, waNumber } from './messagingApi.js';
import { aiApi } from '../../api/aiApi.js';
import { useAiStatus, aiErrorMessage } from '../ai/useAiStatus.js';

dayjs.extend(relativeTime);

const STATUS_COLOR = { sent: 'teal', logged: 'gray', failed: 'red' };

// Compose + history for one record. Sends through the configured provider (SMTP / WhatsApp Cloud API);
// without one, it opens the user's own mail/WhatsApp app and logs the message on the timeline.
export function MessagesPanel({ entityType, entityId, email, phone }) {
  const queryClient = useQueryClient();
  const { configured: aiOn } = useAiStatus();
  const [channel, setChannel] = useState(email || !phone ? 'email' : 'whatsapp');
  const [to, setTo] = useState({ email: email || '', whatsapp: phone || '' });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState(null);

  const { data: channels } = useQuery({ queryKey: ['message-channels'], queryFn: messagingApi.channels, staleTime: 60_000 });
  const { data: templates = [] } = useQuery({ queryKey: ['message-templates'], queryFn: () => messagingApi.templates() });
  const { data: history = [] } = useQuery({ queryKey: ['messages', entityType, entityId], queryFn: () => messagingApi.list(entityType, entityId), enabled: Boolean(entityId) });

  const apiReady = channel === 'email' ? channels?.email : channels?.whatsapp;
  const recipient = to[channel];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['messages', entityType, entityId] });
    queryClient.invalidateQueries({ queryKey: [`${entityType.toLowerCase()}s`] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  };

  const send = useMutation({
    mutationFn: (via) => messagingApi.send({ channel, via, to: recipient, subject: channel === 'email' ? subject : undefined, body, entityType, entityId, templateId: templateId || undefined }),
    onSuccess: (msg) => {
      refresh();
      setBody('');
      setSubject('');
      setTemplateId(null);
      notifications.show({ message: msg.status === 'logged' ? 'Logged on the timeline' : `${channel === 'email' ? 'Email' : 'WhatsApp'} sent`, color: 'teal' });
    },
    onError: (err) => {
      refresh();
      notifications.show({ message: err?.response?.data?.message || 'Sending failed', color: 'red' });
    },
  });

  // Open the user's own app with placeholders already filled in, then log it.
  const openInApp = useMutation({
    mutationFn: async () => {
      const filled = await messagingApi.preview({ entityType, entityId, subject, body });
      const url = channel === 'whatsapp'
        ? `https://wa.me/${waNumber(recipient)}?text=${encodeURIComponent(filled.body)}`
        : `mailto:${recipient}?subject=${encodeURIComponent(filled.subject || '')}&body=${encodeURIComponent(filled.body)}`;
      window.open(url, '_blank', 'noopener');
      return messagingApi.send({ channel, via: 'link', to: recipient, subject: subject || undefined, body, entityType, entityId });
    },
    onSuccess: () => {
      refresh();
      setBody('');
      setSubject('');
      notifications.show({ message: 'Opened in your app and logged on the timeline', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not log message', color: 'red' }),
  });

  const aiWrite = useMutation({
    mutationFn: () => aiApi.draft({ entityType, entityId, channel, language: 'en' }),
    onSuccess: (d) => {
      if (d.subject) setSubject(d.subject);
      setBody(d.body);
    },
    onError: (err) => notifications.show({ message: aiErrorMessage(err), color: 'red' }),
  });

  function applyTemplate(id) {
    setTemplateId(id);
    const t = templates.find((x) => x._id === id);
    if (!t) return;
    if (t.subject) setSubject(t.subject);
    setBody(t.body);
  }

  const canSend = recipient.trim() && body.trim() && (channel === 'whatsapp' || subject.trim() || !apiReady);
  const channelTemplates = templates.filter((t) => t.channel === channel).map((t) => ({ value: t._id, label: t.name }));

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <SegmentedControl
              value={channel}
              onChange={(v) => { setChannel(v); setTemplateId(null); }}
              data={[
                { value: 'email', label: <Group gap={6} wrap="nowrap"><IconMail size={14} />Email</Group> },
                { value: 'whatsapp', label: <Group gap={6} wrap="nowrap"><IconBrandWhatsapp size={14} />WhatsApp</Group> },
              ]}
            />
            <Badge variant="light" color={apiReady ? 'teal' : 'gray'}>
              {apiReady ? (channel === 'email' ? 'Sends via your SMTP' : 'Sends via WhatsApp Business API') : 'Opens your own app'}
            </Badge>
          </Group>

          <Group grow align="flex-start">
            <TextInput
              label={channel === 'email' ? 'To (email)' : 'To (mobile)'}
              value={recipient}
              onChange={(e) => setTo((t) => ({ ...t, [channel]: e.currentTarget.value }))}
              placeholder={channel === 'email' ? 'name@company.com' : '+91 98400 12345'}
            />
            <Select label="Template" placeholder="Choose a template" data={channelTemplates} value={templateId} onChange={applyTemplate} clearable searchable />
          </Group>
          {channel === 'email' && <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />}
          <Textarea
            label="Message"
            description="Placeholders like {{contact.firstName}}, {{company.name}}, {{user.name}} are filled in when sent"
            autosize
            minRows={5}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
          <Group justify="space-between">
            {aiOn ? (
              <Button variant="subtle" color="grape" size="xs" leftSection={<IconSparkles size={14} />} loading={aiWrite.isPending} onClick={() => aiWrite.mutate()} disabled={entityType === 'Ticket'}>
                Write with AI
              </Button>
            ) : <span />}
            <Group gap="xs">
              {apiReady && (
                <Tooltip label="Open in my own app instead">
                  <Button variant="default" size="sm" leftSection={<IconExternalLink size={14} />} disabled={!canSend} loading={openInApp.isPending} onClick={() => openInApp.mutate()}>
                    My app
                  </Button>
                </Tooltip>
              )}
              <Button
                leftSection={apiReady ? <IconSend size={16} /> : <IconExternalLink size={16} />}
                color={channel === 'whatsapp' ? 'green' : undefined}
                disabled={!canSend}
                loading={send.isPending || (!apiReady && openInApp.isPending)}
                onClick={() => (apiReady ? send.mutate('api') : openInApp.mutate())}
              >
                {apiReady ? 'Send' : channel === 'whatsapp' ? 'Open WhatsApp' : 'Open mail app'}
              </Button>
            </Group>
          </Group>
          {!apiReady && (
            <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} p="xs">
              <Text size="xs">
                {channel === 'email' ? 'Connect SMTP' : 'Connect the WhatsApp Business API'} in Settings → Integrations to send directly from NexusCRM. Until then, messages open in your own app and are logged here.
              </Text>
            </Alert>
          )}
        </Stack>
      </Paper>

      <Divider label={`History (${history.length})`} labelPosition="left" />
      {history.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center">No messages yet.</Text>
      ) : (
        <Stack gap="xs">
          {history.map((m) => (
            <Paper key={m._id} p="sm" withBorder>
              <Group justify="space-between" mb={4} wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  {m.channel === 'email' ? <IconMail size={14} /> : <IconBrandWhatsapp size={14} color="var(--mantine-color-green-6)" />}
                  <Text size="sm" fw={600} truncate>{m.subject || `WhatsApp to ${m.to}`}</Text>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" variant="light" color={STATUS_COLOR[m.status]}>{m.status === 'logged' ? 'logged' : m.status}</Badge>
                  <Text size="xs" c="dimmed">{dayjs(m.createdAt).fromNow()}</Text>
                </Group>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={3} style={{ whiteSpace: 'pre-wrap' }}>{m.body}</Text>
              {m.error && <Text size="xs" c="red" mt={4}>{m.error}</Text>}
              <Group gap={6} mt={6}>
                <Avatar size={16} radius="xl" color={m.sentBy?.avatarColor}>{m.sentBy?.name?.[0]}</Avatar>
                <Text size="xs" c="dimmed">{m.sentBy?.name} → {m.to}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
