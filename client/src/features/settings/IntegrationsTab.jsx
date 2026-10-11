import { useEffect, useState } from 'react';
import {
  Paper, Stack, Group, Text, Title, TextInput, PasswordInput, NumberInput, Switch, Button, Badge, ThemeIcon, SimpleGrid, Anchor,
  Textarea, Select, ActionIcon, Modal, Code,
} from '@mantine/core';
import { IconMail, IconBrandWhatsapp, IconPlugConnected, IconPlus, IconPencil, IconTrash, IconTemplate } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { organizationApi } from '../../api/organizationApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { messagingApi } from '../messaging/messagingApi.js';
import { confirmDelete } from '../../components/confirmDelete.js';

const errMsg = (err) => err?.response?.data?.details?.[0]?.message || err?.response?.data?.message || 'Something went wrong';

function useSaveIntegrations() {
  const { user, accessToken, setSession } = useAuthStore.getState();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrations) => organizationApi.update({ integrations }),
    onSuccess: (org) => {
      setSession({ user, organization: org, accessToken });
      queryClient.invalidateQueries({ queryKey: ['message-channels'] });
      notifications.show({ message: 'Integration saved', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: errMsg(err), color: 'red' }),
  });
}

function TestButton({ channel, disabled }) {
  const test = useMutation({
    mutationFn: () => messagingApi.test(channel),
    onSuccess: (r) => notifications.show({ title: 'Connection OK', message: r.message, color: 'teal' }),
    onError: (err) => notifications.show({ title: 'Connection failed', message: errMsg(err), color: 'red' }),
  });
  return <Button variant="default" leftSection={<IconPlugConnected size={16} />} loading={test.isPending} disabled={disabled} onClick={() => test.mutate()}>Test connection</Button>;
}

function SmtpCard({ smtp }) {
  const save = useSaveIntegrations();
  const [v, setV] = useState({});
  useEffect(() => setV({ host: smtp.host || '', port: smtp.port || 587, secure: Boolean(smtp.secure), user: smtp.user || '', pass: '', fromName: smtp.fromName || '', fromEmail: smtp.fromEmail || '' }), [smtp]);
  const ready = smtp.host && smtp.user && smtp.hasPassword && smtp.fromEmail;

  return (
    <Paper p="lg">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" variant="light" color="blue"><IconMail size={20} /></ThemeIcon>
          <div>
            <Title order={4}>Email (SMTP)</Title>
            <Text size="xs" c="dimmed">Gmail / Google Workspace, Zoho Mail, Outlook 365, Amazon SES…</Text>
          </div>
        </Group>
        <Badge color={ready ? 'teal' : 'gray'} variant="light">{ready ? 'Connected' : 'Not set up'}</Badge>
      </Group>
      <Stack gap="sm">
        <Group grow>
          <TextInput label="SMTP host" placeholder="smtp.gmail.com" value={v.host || ''} onChange={(e) => setV({ ...v, host: e.currentTarget.value })} />
          <NumberInput label="Port" value={v.port} onChange={(p) => setV({ ...v, port: Number(p) || 587 })} w={110} />
        </Group>
        <Switch label="Use SSL (port 465)" checked={v.secure || false} onChange={(e) => setV({ ...v, secure: e.currentTarget.checked })} />
        <Group grow>
          <TextInput label="Username" value={v.user || ''} onChange={(e) => setV({ ...v, user: e.currentTarget.value })} />
          <PasswordInput label="Password / app password" placeholder={smtp.hasPassword ? '•••••••• (saved)' : ''} value={v.pass || ''} onChange={(e) => setV({ ...v, pass: e.currentTarget.value })} />
        </Group>
        <Group grow>
          <TextInput label="From name" placeholder="Nexus Sales" value={v.fromName || ''} onChange={(e) => setV({ ...v, fromName: e.currentTarget.value })} />
          <TextInput label="From email" placeholder="sales@yourcompany.in" value={v.fromEmail || ''} onChange={(e) => setV({ ...v, fromEmail: e.currentTarget.value })} />
        </Group>
        <Text size="xs" c="dimmed">For Gmail, create an <Anchor href="https://myaccount.google.com/apppasswords" target="_blank" size="xs">app password</Anchor> and use smtp.gmail.com, port 587.</Text>
        <Group justify="flex-end">
          <TestButton channel="email" disabled={!ready} />
          <Button loading={save.isPending} onClick={() => save.mutate({ smtp: v })}>Save</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function WhatsappCard({ wa }) {
  const save = useSaveIntegrations();
  const [v, setV] = useState({});
  useEffect(() => setV({ phoneNumberId: wa.phoneNumberId || '', accessToken: '', displayNumber: wa.displayNumber || '' }), [wa]);
  const ready = wa.phoneNumberId && wa.hasAccessToken;

  return (
    <Paper p="lg">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" variant="light" color="green"><IconBrandWhatsapp size={20} /></ThemeIcon>
          <div>
            <Title order={4}>WhatsApp Business API</Title>
            <Text size="xs" c="dimmed">Meta Cloud API — send messages straight from NexusCRM</Text>
          </div>
        </Group>
        <Badge color={ready ? 'teal' : 'gray'} variant="light">{ready ? 'Connected' : 'Not set up'}</Badge>
      </Group>
      <Stack gap="sm">
        <TextInput label="Phone number ID" placeholder="1234567890" value={v.phoneNumberId || ''} onChange={(e) => setV({ ...v, phoneNumberId: e.currentTarget.value })} />
        <PasswordInput label="Permanent access token" placeholder={wa.hasAccessToken ? '•••••••• (saved)' : 'EAAG…'} value={v.accessToken || ''} onChange={(e) => setV({ ...v, accessToken: e.currentTarget.value })} />
        <TextInput label="Display number (optional)" placeholder="+91 98400 00000" value={v.displayNumber || ''} onChange={(e) => setV({ ...v, displayNumber: e.currentTarget.value })} />
        <Text size="xs" c="dimmed">
          Get these from <Anchor href="https://developers.facebook.com/apps" target="_blank" size="xs">Meta for Developers</Anchor> → your app → WhatsApp → API Setup.
          Free-form messages can be sent within 24 hours of the customer's last message. Without the API, WhatsApp still works through each user's own WhatsApp (click-to-chat) and is logged.
        </Text>
        <Group justify="flex-end">
          <TestButton channel="whatsapp" disabled={!ready} />
          <Button color="green" loading={save.isPending} onClick={() => save.mutate({ whatsapp: v })}>Save</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function TemplatesCard() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState(null);
  const { data: templates = [] } = useQuery({ queryKey: ['message-templates'], queryFn: () => messagingApi.templates() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['message-templates'] });
  const save = useMutation({
    mutationFn: (t) => {
      const payload = { name: t.name, channel: t.channel, subject: t.channel === 'email' ? t.subject : undefined, body: t.body };
      return t._id ? messagingApi.updateTemplate(t._id, payload) : messagingApi.createTemplate(payload);
    },
    onSuccess: () => { refresh(); setEditor(null); },
    onError: (err) => notifications.show({ message: errMsg(err), color: 'red' }),
  });
  const remove = useMutation({ mutationFn: messagingApi.removeTemplate, onSuccess: refresh });

  return (
    <Paper p="lg">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" variant="light" color="indigo"><IconTemplate size={20} /></ThemeIcon>
          <div>
            <Title order={4}>Message templates</Title>
            <Text size="xs" c="dimmed">Reusable email and WhatsApp copy for the whole team</Text>
          </div>
        </Group>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEditor({ name: '', channel: 'email', subject: '', body: '' })}>New template</Button>
      </Group>
      <Stack gap={6}>
        {templates.map((t) => (
          <Group key={t._id} justify="space-between" p="sm" wrap="nowrap" style={{ borderRadius: 8, background: 'var(--app-subtle)' }}>
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              {t.channel === 'email' ? <IconMail size={16} /> : <IconBrandWhatsapp size={16} color="var(--mantine-color-green-6)" />}
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600}>{t.name}</Text>
                <Text size="xs" c="dimmed" truncate>{t.subject || t.body}</Text>
              </div>
            </Group>
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" onClick={() => setEditor({ ...t })}><IconPencil size={15} /></ActionIcon>
              <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete({ message: `Delete template "${t.name}"?`, onConfirm: () => remove.mutate(t._id) })}><IconTrash size={15} /></ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
      <Modal opened={Boolean(editor)} onClose={() => setEditor(null)} title={<Text fw={700}>{editor?._id ? 'Edit template' : 'New template'}</Text>} size="lg">
        {editor && (
          <Stack>
            <Group grow>
              <TextInput label="Name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.currentTarget.value })} />
              <Select label="Channel" data={[{ value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' }]} value={editor.channel} onChange={(c) => setEditor({ ...editor, channel: c })} allowDeselect={false} />
            </Group>
            {editor.channel === 'email' && <TextInput label="Subject" value={editor.subject || ''} onChange={(e) => setEditor({ ...editor, subject: e.currentTarget.value })} />}
            <Textarea label="Body" autosize minRows={6} value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.currentTarget.value })} />
            <Text size="xs" c="dimmed">
              Placeholders: <Code>{'{{contact.firstName}}'}</Code> <Code>{'{{contact.lastName}}'}</Code> <Code>{'{{company.name}}'}</Code> <Code>{'{{deal.title}}'}</Code> <Code>{'{{user.name}}'}</Code> <Code>{'{{org.name}}'}</Code>
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditor(null)}>Cancel</Button>
              <Button loading={save.isPending} disabled={!editor.name.trim() || !editor.body.trim()} onClick={() => save.mutate(editor)}>Save template</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}

export function IntegrationsTab() {
  const organization = useAuthStore((s) => s.organization);
  const smtp = organization?.integrations?.smtp || {};
  const wa = organization?.integrations?.whatsapp || {};
  return (
    <Stack maw={1100}>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <SmtpCard smtp={smtp} />
        <WhatsappCard wa={wa} />
      </SimpleGrid>
      <TemplatesCard />
    </Stack>
  );
}
