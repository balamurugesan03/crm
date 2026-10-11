import { useState } from 'react';
import {
  Stack, Group, Text, Button, Paper, Badge, ThemeIcon, List, Skeleton, Alert, Select, TextInput, Textarea,
  SegmentedControl, CopyButton, ActionIcon, Tooltip, RingProgress, Divider,
} from '@mantine/core';
import {
  IconSparkles, IconRefresh, IconPlus, IconAlertTriangle, IconPhone, IconMail, IconUsers, IconBrandWhatsapp,
  IconChecklist, IconCopy, IconCheck, IconNotes, IconSend,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { aiApi } from '../../api/aiApi.js';
import { tasksApi } from '../../api/tasksApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';
import { dealsApi } from '../../api/dealsApi.js';
import { useAiStatus, aiErrorMessage } from './useAiStatus.js';
import { AiNotConfigured } from './AiNotConfigured.jsx';

const HEALTH = {
  healthy: { color: 'teal', label: 'Healthy' },
  at_risk: { color: 'orange', label: 'At risk' },
  critical: { color: 'red', label: 'Critical' },
};
const CHANNEL_ICON = { call: IconPhone, email: IconMail, meeting: IconUsers, whatsapp: IconBrandWhatsapp, internal: IconChecklist };
const TASK_TYPE = { call: 'call', email: 'email', meeting: 'meeting', whatsapp: 'call', internal: 'todo' };
const NOTE_API = { Contact: contactsApi, Company: companiesApi, Deal: dealsApi };
const TASK_LINKABLE = ['Contact', 'Company', 'Deal', 'Lead'];

function DraftComposer({ entityType, entityId, email, phone }) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState('email');
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState('warm and professional');
  const [intent, setIntent] = useState('');
  const [draft, setDraft] = useState(null);

  const generate = useMutation({
    mutationFn: () => aiApi.draft({ entityType, entityId, channel, language, tone, intent: intent || undefined }),
    onSuccess: setDraft,
    onError: (err) => notifications.show({ message: aiErrorMessage(err), color: 'red' }),
  });

  const logNote = useMutation({
    mutationFn: () => NOTE_API[entityType].addNote(entityId, `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} sent${draft.subject ? `: ${draft.subject}` : ''}\n\n${draft.body}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${entityType.toLowerCase()}s`] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      notifications.show({ message: 'Logged on the timeline', color: 'teal' });
    },
  });

  const fullText = draft ? `${draft.subject ? `Subject: ${draft.subject}\n\n` : ''}${draft.body}` : '';
  const waNumber = phone?.replace(/[^\d]/g, '');

  return (
    <Paper p="md" withBorder>
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" color="violet" size="sm"><IconSend size={13} /></ThemeIcon>
        <Text fw={700} size="sm">Draft a message</Text>
      </Group>
      <Stack gap="xs">
        <Group grow gap="xs">
          <SegmentedControl
            size="xs"
            value={channel}
            onChange={setChannel}
            data={[{ value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' }]}
          />
          <Select
            size="xs"
            value={language}
            onChange={(v) => setLanguage(v || 'en')}
            allowDeselect={false}
            data={[
              { value: 'en', label: 'English' },
              { value: 'tanglish', label: 'Tanglish' },
              { value: 'ta', label: 'தமிழ் (Tamil)' },
              { value: 'hi', label: 'हिन्दी (Hindi)' },
            ]}
          />
          <Select
            size="xs"
            value={tone}
            onChange={(v) => setTone(v || tone)}
            allowDeselect={false}
            data={['warm and professional', 'formal', 'friendly and casual', 'urgent but polite', 'apologetic']}
          />
        </Group>
        <TextInput
          size="xs"
          placeholder="Goal (optional) — e.g. follow up on the quote, ask for a demo slot next week"
          value={intent}
          onChange={(e) => setIntent(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button size="xs" variant="light" color="violet" leftSection={<IconSparkles size={14} />} loading={generate.isPending} onClick={() => generate.mutate()}>
            {draft ? 'Regenerate' : 'Write it for me'}
          </Button>
        </Group>

        {draft && (
          <Stack gap="xs" mt={4}>
            {draft.subject && (
              <TextInput size="xs" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.currentTarget.value })} />
            )}
            <Textarea autosize minRows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value })} />
            <Group gap="xs" justify="flex-end">
              <CopyButton value={fullText}>
                {({ copied, copy }) => (
                  <Button size="xs" variant="default" leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
              {channel === 'email' && email && (
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconMail size={14} />}
                  component="a"
                  href={`mailto:${email}?subject=${encodeURIComponent(draft.subject || '')}&body=${encodeURIComponent(draft.body)}`}
                >
                  Open in mail
                </Button>
              )}
              {channel === 'whatsapp' && waNumber && (
                <Button
                  size="xs"
                  color="green"
                  variant="light"
                  leftSection={<IconBrandWhatsapp size={14} />}
                  component="a"
                  target="_blank"
                  rel="noopener"
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(draft.body)}`}
                >
                  Open WhatsApp
                </Button>
              )}
              {NOTE_API[entityType] && (
                <Button size="xs" variant="default" leftSection={<IconNotes size={14} />} loading={logNote.isPending} onClick={() => logNote.mutate()}>
                  Log as sent
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// AI assessment of one record: summary, health, win probability, risks and one-click next actions.
export function AiInsightsPanel({ entityType, entityId, email, phone }) {
  const queryClient = useQueryClient();
  const { configured, loaded } = useAiStatus();
  const [insights, setInsights] = useState(null);
  const [created, setCreated] = useState({});

  const analyze = useMutation({
    mutationFn: () => aiApi.insights(entityType, entityId),
    onSuccess: (data) => {
      setInsights({ ...data, at: new Date() });
      setCreated({});
    },
  });

  const addTask = useMutation({
    mutationFn: (action) =>
      tasksApi.create({
        title: action.title,
        type: TASK_TYPE[action.channel] || 'todo',
        priority: action.priority,
        dueDate: dayjs().add(Math.max(0, Math.min(30, action.dueInDays)), 'day').hour(10).minute(0).toDate(),
        relatedToModel: TASK_LINKABLE.includes(entityType) ? entityType : null,
        relatedToId: TASK_LINKABLE.includes(entityType) ? entityId : null,
      }),
    onSuccess: (task, action) => {
      setCreated((c) => ({ ...c, [action.title]: true }));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notifications.show({ message: 'Task created', color: 'teal' });
    },
  });

  if (loaded && !configured) return <AiNotConfigured />;

  if (!insights && !analyze.isPending) {
    return (
      <Stack gap="md">
        <Paper p="xl" ta="center" withBorder style={{ background: 'linear-gradient(135deg, rgba(95,98,245,0.08), rgba(168,85,247,0.08))' }}>
          <ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }} mx="auto" mb="sm">
            <IconSparkles size={24} />
          </ThemeIcon>
          <Text fw={700}>AI deal intelligence</Text>
          <Text size="sm" c="dimmed" maw={380} mx="auto" mt={4}>
            Nexus AI reads the full timeline, tasks, meetings and quotes, then tells you where things stand and what to do next.
          </Text>
          {analyze.isError && <Alert color="red" mt="md" variant="light">{aiErrorMessage(analyze.error)}</Alert>}
          <Button mt="md" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }} leftSection={<IconSparkles size={16} />} onClick={() => analyze.mutate()}>
            Analyze with AI
          </Button>
        </Paper>
        <DraftComposer entityType={entityType} entityId={entityId} email={email} phone={phone} />
      </Stack>
    );
  }

  if (analyze.isPending) {
    return (
      <Stack gap="sm">
        <Group gap="xs"><IconSparkles size={16} color="var(--mantine-color-violet-6)" /><Text size="sm" c="dimmed">Reading the record and thinking…</Text></Group>
        <Skeleton h={80} radius="md" />
        <Skeleton h={18} w="60%" />
        <Skeleton h={120} radius="md" />
      </Stack>
    );
  }

  const health = HEALTH[insights.health] || HEALTH.at_risk;

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div style={{ flex: 1 }}>
            <Group gap="xs" mb={6}>
              <Badge color={health.color} variant="light" size="lg">{health.label}</Badge>
              <Text size="xs" c="dimmed">{insights.healthReason}</Text>
            </Group>
            <Text size="sm" style={{ lineHeight: 1.6 }}>{insights.summary}</Text>
          </div>
          {typeof insights.winProbability === 'number' && (
            <Tooltip label="AI-estimated chance to close">
              <RingProgress
                size={84}
                thickness={8}
                roundCaps
                sections={[{ value: insights.winProbability, color: insights.winProbability >= 60 ? 'teal' : insights.winProbability >= 35 ? 'orange' : 'red' }]}
                label={<Text ta="center" fw={800} size="sm">{insights.winProbability}%</Text>}
              />
            </Tooltip>
          )}
        </Group>
      </Paper>

      {insights.risks.length > 0 && (
        <Paper p="md" withBorder>
          <Group gap="xs" mb="xs">
            <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" />
            <Text fw={700} size="sm">Risks</Text>
          </Group>
          <List size="sm" spacing={4}>
            {insights.risks.map((r) => <List.Item key={r}>{r}</List.Item>)}
          </List>
        </Paper>
      )}

      <Paper p="md" withBorder>
        <Text fw={700} size="sm" mb="sm">Next best actions</Text>
        <Stack gap="sm">
          {insights.nextActions.map((a) => {
            const Icon = CHANNEL_ICON[a.channel] || IconChecklist;
            return (
              <Group key={a.title} justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color={a.priority === 'high' ? 'red' : a.priority === 'medium' ? 'orange' : 'gray'} size={30} radius="md">
                    <Icon size={16} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600}>{a.title}</Text>
                    <Text size="xs" c="dimmed">{a.reason}</Text>
                    <Text size="xs" c="dimmed">Due {a.dueInDays === 0 ? 'today' : dayjs().add(a.dueInDays, 'day').format('ddd, D MMM')}</Text>
                  </div>
                </Group>
                <Tooltip label={created[a.title] ? 'Task created' : 'Create as task'}>
                  <ActionIcon
                    variant={created[a.title] ? 'light' : 'default'}
                    color={created[a.title] ? 'teal' : undefined}
                    disabled={created[a.title]}
                    loading={addTask.isPending && addTask.variables?.title === a.title}
                    onClick={() => addTask.mutate(a)}
                  >
                    {created[a.title] ? <IconCheck size={16} /> : <IconPlus size={16} />}
                  </ActionIcon>
                </Tooltip>
              </Group>
            );
          })}
        </Stack>
        <Divider my="sm" />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Generated {dayjs(insights.at).format('h:mm A')} · AI can make mistakes — verify before acting</Text>
          <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={() => analyze.mutate()}>Refresh</Button>
        </Group>
      </Paper>

      <DraftComposer entityType={entityType} entityId={entityId} email={email} phone={phone} />
    </Stack>
  );
}
