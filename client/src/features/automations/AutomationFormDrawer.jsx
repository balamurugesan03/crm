import { useEffect } from 'react';
import {
  Stack, TextInput, Textarea, Button, Group, Select, NumberInput, Paper, Text, ActionIcon, Divider, Badge, ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconBolt, IconFilter, IconPlayerPlay } from '@tabler/icons-react';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { automationsApi } from '../../api/automationsApi.js';
import { usersApi } from '../../api/usersApi.js';
import { TRIGGERS, FIELDS_BY_ENTITY, OPERATORS, ACTIONS, entityOf } from './automationMeta.js';

const EMPTY_ACTION = { type: 'create_task', taskTitle: 'Follow up with {{name}}', taskDueInDays: 1, taskPriority: 'medium', assignTo: 'owner', message: '', field: '', value: '' };
const EMPTY = { name: '', description: '', trigger: 'lead.created', conditions: [], actions: [EMPTY_ACTION], isActive: true };

function StepHeader({ icon: Icon, color, step, title, hint }) {
  return (
    <Group gap="sm" mb="xs">
      <ThemeIcon size={28} radius="xl" variant="light" color={color}><Icon size={15} /></ThemeIcon>
      <div>
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Step {step}</Text>
        <Text fw={600} size="sm">{title}</Text>
      </div>
      {hint && <Text size="xs" c="dimmed" ml="auto">{hint}</Text>}
    </Group>
  );
}

export function AutomationFormDrawer({ opened, onClose, automation }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(automation?._id);
  const { data: users = [] } = useQuery({ queryKey: ['team'], queryFn: usersApi.list, enabled: opened });

  const form = useForm({
    initialValues: EMPTY,
    validate: {
      name: (v) => (v.trim() ? null : 'Give this automation a name'),
      actions: (v) => (v.length ? null : 'Add at least one action'),
    },
  });

  useEffect(() => {
    if (opened) form.setValues(isEdit ? { ...EMPTY, ...automation } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, automation]);

  const save = useMutation({
    mutationFn: (values) => (isEdit ? automationsApi.update(automation._id, values) : automationsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      notifications.show({ message: isEdit ? 'Automation updated' : 'Automation created', color: 'teal' });
      onClose();
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not save', color: 'red' }),
  });

  const fields = FIELDS_BY_ENTITY[entityOf(form.values.trigger)] || [];
  const recipientOptions = [{ value: 'owner', label: 'Record owner / assignee' }, ...users.map((u) => ({ value: String(u.id), label: u.name }))];

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit automation' : 'New automation'} size={560}>
      <form onSubmit={form.onSubmit((values) => save.mutate(values))}>
        <Stack>
          <TextInput label="Name" placeholder="e.g. Call back high-value leads" required {...form.getInputProps('name')} />
          <Textarea label="Description" autosize minRows={1} {...form.getInputProps('description')} />

          <Divider />
          <Paper p="md" withBorder>
            <StepHeader icon={IconPlayerPlay} color="indigo" step={1} title="When this happens" />
            <Select
              data={Object.entries(
                TRIGGERS.reduce((acc, t) => ({ ...acc, [t.group]: [...(acc[t.group] || []), { value: t.value, label: t.label }] }), {}),
              ).map(([group, items]) => ({ group, items }))}
              allowDeselect={false}
              {...form.getInputProps('trigger')}
              onChange={(v) => {
                form.setFieldValue('trigger', v);
                form.setFieldValue('conditions', []);
              }}
            />
          </Paper>

          <Paper p="md" withBorder>
            <StepHeader icon={IconFilter} color="orange" step={2} title="Only if (optional)" hint="All conditions must match" />
            <Stack gap="xs">
              {form.values.conditions.map((c, i) => {
                const field = fields.find((f) => f.value === c.field);
                return (
                  <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
                    <Select placeholder="Field" data={fields} w={150} {...form.getInputProps(`conditions.${i}.field`)} />
                    <Select data={OPERATORS} w={140} allowDeselect={false} {...form.getInputProps(`conditions.${i}.operator`)} />
                    {field?.options ? (
                      <Select data={field.options} style={{ flex: 1 }} {...form.getInputProps(`conditions.${i}.value`)} />
                    ) : (
                      <TextInput placeholder="Value" style={{ flex: 1 }} {...form.getInputProps(`conditions.${i}.value`)} />
                    )}
                    <ActionIcon variant="subtle" color="red" mt={6} onClick={() => form.removeListItem('conditions', i)}><IconTrash size={16} /></ActionIcon>
                  </Group>
                );
              })}
              <Button
                variant="light"
                size="xs"
                color="orange"
                leftSection={<IconPlus size={14} />}
                w="fit-content"
                onClick={() => form.insertListItem('conditions', { field: fields[0]?.value || '', operator: 'equals', value: '' })}
              >
                Add condition
              </Button>
            </Stack>
          </Paper>

          <Paper p="md" withBorder>
            <StepHeader icon={IconBolt} color="teal" step={3} title="Do this" />
            <Stack gap="sm">
              {form.values.actions.map((a, i) => (
                <Paper key={i} p="sm" bg="var(--app-subtle)" withBorder={false}>
                  <Group justify="space-between" mb="xs">
                    <Badge variant="light" color="teal">Action {i + 1}</Badge>
                    {form.values.actions.length > 1 && (
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => form.removeListItem('actions', i)}><IconTrash size={14} /></ActionIcon>
                    )}
                  </Group>
                  <Stack gap="xs">
                    <Select data={ACTIONS} allowDeselect={false} {...form.getInputProps(`actions.${i}.type`)} />
                    {a.type === 'create_task' && (
                      <>
                        <TextInput label="Task title" description="Use {{name}}, {{title}}, {{amount}} etc. as placeholders" {...form.getInputProps(`actions.${i}.taskTitle`)} />
                        <Group grow>
                          <NumberInput label="Due in (days)" min={0} max={365} {...form.getInputProps(`actions.${i}.taskDueInDays`)} />
                          <Select label="Priority" data={['low', 'medium', 'high']} allowDeselect={false} {...form.getInputProps(`actions.${i}.taskPriority`)} />
                        </Group>
                        <Select label="Assign to" data={recipientOptions} allowDeselect={false} {...form.getInputProps(`actions.${i}.assignTo`)} />
                      </>
                    )}
                    {a.type === 'notify_user' && (
                      <>
                        <Select label="Notify" data={recipientOptions} allowDeselect={false} {...form.getInputProps(`actions.${i}.assignTo`)} />
                        <TextInput label="Message" placeholder="New lead: {{name}}" {...form.getInputProps(`actions.${i}.message`)} />
                      </>
                    )}
                    {a.type === 'update_field' && (
                      <Group grow>
                        <Select label="Field" data={fields.filter((f) => f.value !== 'stageName' && f.value !== 'score')} {...form.getInputProps(`actions.${i}.field`)} />
                        {fields.find((f) => f.value === a.field)?.options ? (
                          <Select label="Set to" data={fields.find((f) => f.value === a.field).options} {...form.getInputProps(`actions.${i}.value`)} />
                        ) : (
                          <TextInput label="Set to" {...form.getInputProps(`actions.${i}.value`)} />
                        )}
                      </Group>
                    )}
                    {a.type === 'add_note' && (
                      <Textarea label="Note" autosize minRows={2} placeholder="Automatically flagged for review" {...form.getInputProps(`actions.${i}.message`)} />
                    )}
                  </Stack>
                </Paper>
              ))}
              <Button variant="light" size="xs" color="teal" leftSection={<IconPlus size={14} />} w="fit-content" onClick={() => form.insertListItem('actions', { ...EMPTY_ACTION })}>
                Add action
              </Button>
            </Stack>
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{isEdit ? 'Save changes' : 'Create automation'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
