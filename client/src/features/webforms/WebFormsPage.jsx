import { useEffect, useState } from 'react';
import {
  Button, SimpleGrid, Paper, Group, Text, Badge, ActionIcon, Menu, Stack, ThemeIcon, Switch, TextInput, Textarea, Select,
  MultiSelect, Checkbox, ColorInput, Code, CopyButton, Tooltip, Grid, Divider, Modal, Skeleton,
} from '@mantine/core';
import {
  IconPlus, IconForms, IconDotsVertical, IconPencil, IconTrash, IconCopy, IconCheck, IconCode, IconExternalLink, IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

import { PageHeader } from '../../components/PageHeader.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { FormDrawer } from '../../components/FormDrawer.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { createResourceApi } from '../../api/resource.js';
import { usersApi } from '../../api/usersApi.js';
import { campaignsApi } from '../../api/campaignsApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { PublicFormView } from './PublicFormView.jsx';
import { absoluteUrl, appPath } from '../../utils/paths.js';

dayjs.extend(relativeTime);

const webFormsApi = createResourceApi('/web-forms');

const FIELD_LIBRARY = [
  { key: 'name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'city', label: 'City' },
  { key: 'budget', label: 'Budget (₹)' },
  { key: 'message', label: 'Message' },
];

const SOURCES = ['website', 'referral', 'social', 'event', 'advertisement', 'other'];
const EMPTY = {
  name: '',
  title: 'Get in touch',
  description: '',
  submitLabel: 'Submit',
  successMessage: 'Thanks! Our team will reach out shortly.',
  accentColor: '#4f4ff0',
  fields: FIELD_LIBRARY.filter((f) => ['name', 'email', 'phone', 'message'].includes(f.key)).map((f) => ({ ...f, required: f.key !== 'message' })),
  source: 'website',
  campaign: null,
  assignees: [],
  isActive: true,
};

const publicUrl = (key) => absoluteUrl(`/f/${key}`);
const embedCode = (key) =>
  `<iframe src="${publicUrl(key)}?embed=1" style="width:100%;max-width:520px;height:640px;border:0" title="Contact form" loading="lazy"></iframe>`;

function FormBuilder({ opened, onClose, form }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(form?._id);
  const [values, setValues] = useState(EMPTY);
  const { data: users = [] } = useQuery({ queryKey: ['team'], queryFn: usersApi.list, enabled: opened });
  const { data: campaigns } = useQuery({ queryKey: ['campaigns', { forSelect: true }], queryFn: () => campaignsApi.list({ limit: 100 }), enabled: opened });

  useEffect(() => {
    if (!opened) return;
    setValues(
      isEdit
        ? { ...EMPTY, ...form, campaign: form.campaign || null, assignees: (form.assignees || []).map((a) => a._id || a) }
        : EMPTY,
    );
  }, [opened, form, isEdit]);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));
  const hasField = (key) => values.fields.some((f) => f.key === key);
  const toggleField = (key) =>
    set({
      fields: hasField(key)
        ? values.fields.filter((f) => f.key !== key)
        : [...values.fields, { ...FIELD_LIBRARY.find((f) => f.key === key), required: false }],
    });
  const updateField = (i, patch) => set({ fields: values.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const moveField = (i, dir) => {
    const next = [...values.fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ fields: next });
  };

  const save = useMutation({
    mutationFn: () => {
      const { _id, __v, organization, publicKey, submissions, lastSubmissionAt, createdAt, updatedAt, createdBy, rrIndex, ...payload } = values;
      payload.fields = payload.fields.map(({ key, label, required }) => ({ key, label, required }));
      return isEdit ? webFormsApi.update(form._id, payload) : webFormsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-forms'] });
      notifications.show({ message: isEdit ? 'Form updated' : 'Form created', color: 'teal' });
      onClose();
    },
    onError: (err) => {
      const d = err?.response?.data;
      notifications.show({ message: d?.details?.[0]?.message || d?.message || 'Could not save form', color: 'red' });
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit web form' : 'New web form'} size="min(1100px, 100%)">
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack>
            <TextInput label="Internal name" placeholder="Website — Contact us" required value={values.name} onChange={(e) => set({ name: e.currentTarget.value })} />
            <TextInput label="Heading" value={values.title} onChange={(e) => set({ title: e.currentTarget.value })} />
            <Textarea label="Intro text" autosize minRows={2} value={values.description} onChange={(e) => set({ description: e.currentTarget.value })} />

            <Divider label="Fields" labelPosition="left" />
            <Group gap={6}>
              {FIELD_LIBRARY.map((f) => (
                <Badge
                  key={f.key}
                  variant={hasField(f.key) ? 'filled' : 'outline'}
                  style={{ cursor: f.key === 'name' ? 'not-allowed' : 'pointer' }}
                  onClick={() => f.key !== 'name' && toggleField(f.key)}
                >
                  {hasField(f.key) ? '✓ ' : '+ '}{f.label}
                </Badge>
              ))}
            </Group>
            <Stack gap={6}>
              {values.fields.map((f, i) => (
                <Group key={f.key} gap="xs" wrap="nowrap">
                  <Stack gap={0}>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => moveField(i, -1)} disabled={i === 0}><IconArrowUp size={12} /></ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => moveField(i, 1)} disabled={i === values.fields.length - 1}><IconArrowDown size={12} /></ActionIcon>
                  </Stack>
                  <TextInput size="xs" style={{ flex: 1 }} value={f.label} onChange={(e) => updateField(i, { label: e.currentTarget.value })} />
                  <Checkbox size="xs" label="Required" checked={f.required} disabled={f.key === 'name'} onChange={(e) => updateField(i, { required: e.currentTarget.checked })} />
                </Group>
              ))}
            </Stack>

            <Divider label="Routing" labelPosition="left" />
            <Group grow>
              <Select label="Lead source" data={SOURCES} value={values.source} onChange={(v) => set({ source: v || 'website' })} allowDeselect={false} />
              <Select
                label="Campaign"
                data={(campaigns?.items || []).map((c) => ({ value: c._id, label: c.name }))}
                value={values.campaign}
                onChange={(v) => set({ campaign: v })}
                clearable
              />
            </Group>
            <MultiSelect
              label="Assign new leads to"
              description="Leads rotate round-robin between these people. Leave empty to assign to you."
              data={users.map((u) => ({ value: u.id, label: u.name }))}
              value={values.assignees}
              onChange={(v) => set({ assignees: v })}
              searchable
            />

            <Divider label="Appearance" labelPosition="left" />
            <Group grow>
              <TextInput label="Button text" value={values.submitLabel} onChange={(e) => set({ submitLabel: e.currentTarget.value })} />
              <ColorInput label="Accent colour" value={values.accentColor} onChange={(v) => set({ accentColor: v })} format="hex" />
            </Group>
            <Textarea label="Thank-you message" autosize minRows={2} value={values.successMessage} onChange={(e) => set({ successMessage: e.currentTarget.value })} />

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!values.name.trim()}>{isEdit ? 'Save form' : 'Create form'}</Button>
            </Group>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">Live preview</Text>
          <Paper p="xl" radius="lg" bg="white" c="#1a1d29" style={{ colorScheme: 'light', position: 'sticky', top: 0 }}>
            <PublicFormView form={values} preview />
          </Paper>
        </Grid.Col>
      </Grid>
    </FormDrawer>
  );
}

export function WebFormsPage() {
  const queryClient = useQueryClient();
  const canManage = ['owner', 'admin', 'manager'].includes(useAuthStore((s) => s.user?.role));
  const [builder, setBuilder] = useState({ opened: false, form: null });
  const [embedFor, setEmbedFor] = useState(null);
  const { data: forms = [], isLoading } = useQuery({ queryKey: ['web-forms'], queryFn: () => webFormsApi.list() });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => webFormsApi.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['web-forms'] }),
  });
  const remove = useMutation({
    mutationFn: webFormsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['web-forms'] }),
  });

  return (
    <>
      <PageHeader
        title="Web forms"
        subtitle="Capture leads straight from your website — every submission lands in Leads, scored and assigned"
        action={canManage && <Button leftSection={<IconPlus size={16} />} onClick={() => setBuilder({ opened: true, form: null })}>New form</Button>}
      />

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, md: 2 }}>{[0, 1].map((i) => <Skeleton key={i} h={180} radius="lg" />)}</SimpleGrid>
      ) : forms.length === 0 ? (
        <Paper>
          <EmptyState
            icon={IconForms}
            title="No web forms yet"
            description="Build a lead-capture form in a minute, then share the link or embed it on your site."
            actionLabel={canManage ? 'Create form' : undefined}
            onAction={() => setBuilder({ opened: true, form: null })}
          />
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {forms.map((f) => (
            <Paper key={f._id} p="lg" shadow="xs" className="hover-lift" style={{ opacity: f.isActive ? 1 : 0.65 }}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon size={40} radius="md" variant="light" color="indigo"><IconForms size={20} /></ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} truncate>{f.name}</Text>
                    <Text size="xs" c="dimmed" truncate>{f.title} · {f.fields.length} fields · source: {f.source}</Text>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Switch checked={f.isActive} disabled={!canManage} onChange={(e) => toggle.mutate({ id: f._id, isActive: e.currentTarget.checked })} aria-label="Form active" />
                  {canManage && (
                    <Menu position="bottom-end">
                      <Menu.Target><ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon></Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setBuilder({ opened: true, form: f })}>Edit</Menu.Item>
                        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => confirmDelete({ message: `Delete form "${f.name}"? Its link will stop working.`, onConfirm: () => remove.mutate(f._id) })}>
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Group>

              <Group mt="md" gap="xl">
                <div><Text fz={24} fw={750}>{f.submissions}</Text><Text size="xs" c="dimmed">submissions</Text></div>
                <div>
                  <Text size="sm" fw={600}>{f.lastSubmissionAt ? dayjs(f.lastSubmissionAt).fromNow() : '—'}</Text>
                  <Text size="xs" c="dimmed">last lead</Text>
                </div>
                <div>
                  <Text size="sm" fw={600}>{f.assignees?.length ? f.assignees.map((a) => a.name.split(' ')[0]).join(', ') : 'Creator'}</Text>
                  <Text size="xs" c="dimmed">round-robin</Text>
                </div>
              </Group>

              <Group mt="md" gap="xs" pt="sm" style={{ borderTop: '1px solid var(--app-border)' }}>
                <CopyButton value={publicUrl(f.publicKey)}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="light" leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />} onClick={copy}>
                      {copied ? 'Link copied' : 'Copy link'}
                    </Button>
                  )}
                </CopyButton>
                <Button size="xs" variant="default" leftSection={<IconCode size={14} />} onClick={() => setEmbedFor(f)}>Embed</Button>
                <Tooltip label="Open hosted form">
                  <ActionIcon variant="default" size="md" component="a" href={appPath(`/f/${f.publicKey}`)} target="_blank" rel="noopener"><IconExternalLink size={14} /></ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <FormBuilder opened={builder.opened} form={builder.form} onClose={() => setBuilder({ opened: false, form: null })} />

      <Modal opened={Boolean(embedFor)} onClose={() => setEmbedFor(null)} title={<Text fw={700}>Embed “{embedFor?.name}”</Text>} size="lg">
        {embedFor && (
          <Stack>
            <Text size="sm" c="dimmed">Paste this snippet into any page of your website (WordPress, Wix, Webflow, plain HTML).</Text>
            <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{embedCode(embedFor.publicKey)}</Code>
            <Group justify="flex-end">
              <CopyButton value={embedCode(embedFor.publicKey)}>
                {({ copied, copy }) => <Button leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>{copied ? 'Copied' : 'Copy snippet'}</Button>}
              </CopyButton>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
