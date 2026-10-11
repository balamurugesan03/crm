import { useState } from 'react';
import {
  Paper, Stack, Group, Text, Button, SegmentedControl, Badge, ActionIcon, TextInput, Select, TagsInput, Switch, Modal, Tooltip,
} from '@mantine/core';
import { IconPlus, IconPencil, IconTrash, IconAsterisk } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { customFieldsApi } from '../../components/CustomFields.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { EmptyState } from '../../components/EmptyState.jsx';

const ENTITIES = ['Contact', 'Company', 'Lead', 'Deal'];
const TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Amount (₹)' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Yes / No' },
  { value: 'url', label: 'Link (URL)' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
const EMPTY = { label: '', type: 'text', options: [], required: false, helpText: '' };

export function CustomFieldsTab() {
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState('Contact');
  const [editor, setEditor] = useState(null); // null | { ...field }

  const { data: fields = [] } = useQuery({ queryKey: ['custom-fields', entity], queryFn: () => customFieldsApi.list(entity) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
  const onError = (err) => notifications.show({ message: err?.response?.data?.details?.[0]?.message || err?.response?.data?.message || 'Could not save', color: 'red' });

  const save = useMutation({
    mutationFn: (f) => {
      const payload = { label: f.label, options: f.options, required: f.required, helpText: f.helpText };
      return f._id ? customFieldsApi.update(f._id, payload) : customFieldsApi.create({ ...payload, entity, type: f.type });
    },
    onSuccess: () => {
      invalidate();
      setEditor(null);
      notifications.show({ message: 'Field saved', color: 'teal' });
    },
    onError,
  });
  const remove = useMutation({ mutationFn: customFieldsApi.remove, onSuccess: invalidate, onError });
  const reorder = useMutation({
    mutationFn: (list) => Promise.all(list.map((f, i) => customFieldsApi.update(f._id, { order: i }))),
    onSuccess: invalidate,
  });

  const isChoice = editor && ['select', 'multiselect'].includes(editor.type);

  return (
    <Paper p="lg" maw={860}>
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={700}>Custom fields</Text>
          <Text size="sm" c="dimmed">Capture the details that matter to your business — they appear on forms and record pages.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({ ...EMPTY })}>Add field</Button>
      </Group>

      <SegmentedControl value={entity} onChange={setEntity} data={ENTITIES.map((e) => ({ value: e, label: `${e}s` }))} mb="md" />

      {fields.length === 0 ? (
        <EmptyState title={`No custom fields on ${entity.toLowerCase()}s`} description="Add one to start capturing extra information." />
      ) : (
        <Stack gap={6}>
          {fields.map((f, i) => (
            <Group key={f._id} justify="space-between" p="sm" wrap="nowrap" style={{ borderRadius: 8, background: 'var(--app-subtle)' }}>
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Stack gap={0}>
                  <ActionIcon size="xs" variant="subtle" color="gray" disabled={i === 0} onClick={() => { const l = [...fields]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; reorder.mutate(l); }}>▲</ActionIcon>
                  <ActionIcon size="xs" variant="subtle" color="gray" disabled={i === fields.length - 1} onClick={() => { const l = [...fields]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; reorder.mutate(l); }}>▼</ActionIcon>
                </Stack>
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text fw={600} size="sm">{f.label}</Text>
                    {f.required && <Tooltip label="Required"><IconAsterisk size={10} color="var(--mantine-color-red-6)" /></Tooltip>}
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {TYPE_LABEL[f.type]} · key <code>{f.key}</code>{f.options?.length ? ` · ${f.options.join(', ')}` : ''}
                  </Text>
                </div>
              </Group>
              <Group gap={4} wrap="nowrap">
                <Badge variant="light" color="gray">{TYPE_LABEL[f.type]}</Badge>
                <ActionIcon variant="subtle" color="gray" onClick={() => setEditor({ ...f })}><IconPencil size={16} /></ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => confirmDelete({ message: `Delete "${f.label}"? Values already saved on records will be hidden.`, onConfirm: () => remove.mutate(f._id) })}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      <Modal opened={Boolean(editor)} onClose={() => setEditor(null)} title={<Text fw={700}>{editor?._id ? 'Edit field' : `New ${entity.toLowerCase()} field`}</Text>}>
        {editor && (
          <Stack>
            <TextInput label="Label" required value={editor.label} onChange={(e) => setEditor({ ...editor, label: e.currentTarget.value })} />
            <Select
              label="Type"
              data={TYPES}
              value={editor.type}
              onChange={(v) => setEditor({ ...editor, type: v })}
              disabled={Boolean(editor._id)}
              description={editor._id ? 'Type cannot change after creation' : undefined}
              allowDeselect={false}
            />
            {isChoice && (
              <TagsInput label="Options" description="Press Enter after each option" value={editor.options} onChange={(v) => setEditor({ ...editor, options: v })} />
            )}
            <TextInput label="Help text" value={editor.helpText || ''} onChange={(e) => setEditor({ ...editor, helpText: e.currentTarget.value })} />
            <Switch label="Required" checked={editor.required} onChange={(e) => setEditor({ ...editor, required: e.currentTarget.checked })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditor(null)}>Cancel</Button>
              <Button loading={save.isPending} disabled={!editor.label.trim() || (isChoice && !editor.options.length)} onClick={() => save.mutate(editor)}>Save field</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
