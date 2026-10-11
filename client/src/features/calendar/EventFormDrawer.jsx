import { useEffect } from 'react';
import { Stack, TextInput, Textarea, Button, Group, Select, MultiSelect, SegmentedControl, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconMapPin } from '@tabler/icons-react';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { confirmDelete } from '../../components/confirmDelete.js';
import { eventsApi } from '../../api/eventsApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';
import { dealsApi } from '../../api/dealsApi.js';
import { usersApi } from '../../api/usersApi.js';

export const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', color: 'indigo' },
  { value: 'call', label: 'Call', color: 'teal' },
  { value: 'demo', label: 'Demo', color: 'grape' },
  { value: 'follow_up', label: 'Follow-up', color: 'orange' },
  { value: 'other', label: 'Other', color: 'gray' },
];

const idOf = (v) => v?._id || v || null;

function emptyValues(defaultStart) {
  const start = defaultStart || new Date();
  return {
    title: '',
    type: 'meeting',
    start,
    end: new Date(start.getTime() + 30 * 60000),
    location: '',
    description: '',
    attendees: [],
    contact: null,
    company: null,
    deal: null,
    status: 'scheduled',
  };
}

export function EventFormDrawer({ opened, onClose, event, defaultStart }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(event?._id);

  const { data: users = [] } = useQuery({ queryKey: ['team'], queryFn: usersApi.list, enabled: opened });
  const { data: contactsData } = useQuery({ queryKey: ['contacts', { forSelect: true }], queryFn: () => contactsApi.list({ limit: 100 }), enabled: opened });
  const { data: companiesData } = useQuery({ queryKey: ['companies', { forSelect: true }], queryFn: () => companiesApi.list({ limit: 100 }), enabled: opened });
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: dealsApi.list, enabled: opened });

  const form = useForm({
    initialValues: emptyValues(),
    validate: {
      title: (v) => (v.trim() ? null : 'Title is required'),
      start: (v) => (v ? null : 'Start time is required'),
      end: (v, values) => (v && values.start && new Date(v) < new Date(values.start) ? 'End must be after start' : null),
    },
  });

  useEffect(() => {
    if (!opened) return;
    if (isEdit) {
      form.setValues({
        ...emptyValues(),
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
        attendees: (event.attendees || []).map(idOf),
        contact: idOf(event.contact),
        company: idOf(event.company),
        deal: idOf(event.deal),
      });
    } else {
      form.setValues(emptyValues(defaultStart));
    }
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, event, defaultStart]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const save = useMutation({
    mutationFn: (values) => (isEdit ? eventsApi.update(event._id, values) : eventsApi.create(values)),
    onSuccess: () => {
      invalidate();
      notifications.show({ message: isEdit ? 'Event updated' : 'Event scheduled', color: 'teal' });
      onClose();
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not save event', color: 'red' }),
  });

  const remove = useMutation({
    mutationFn: () => eventsApi.remove(event._id),
    onSuccess: () => {
      invalidate();
      notifications.show({ message: 'Event deleted', color: 'gray' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit event' : 'Schedule event'} size={460}>
      <form onSubmit={form.onSubmit((values) => save.mutate(values))}>
        <Stack>
          <TextInput label="Title" placeholder="e.g. Product demo with Zenith" required {...form.getInputProps('title')} />
          <div>
            <Text size="sm" fw={500} mb={4}>Type</Text>
            <SegmentedControl fullWidth size="xs" data={EVENT_TYPES.map(({ value, label }) => ({ value, label }))} {...form.getInputProps('type')} />
          </div>
          <Group grow>
            <DateTimePicker
              label="Starts"
              required
              valueFormat="DD MMM YYYY, hh:mm A"
              {...form.getInputProps('start')}
              onChange={(v) => {
                const prevStart = form.values.start ? new Date(form.values.start).getTime() : null;
                const prevEnd = form.values.end ? new Date(form.values.end).getTime() : null;
                form.setFieldValue('start', v);
                // Keep the meeting length when the start moves.
                if (v && prevStart && prevEnd) form.setFieldValue('end', new Date(new Date(v).getTime() + (prevEnd - prevStart)));
              }}
            />
            <DateTimePicker label="Ends" valueFormat="DD MMM YYYY, hh:mm A" {...form.getInputProps('end')} />
          </Group>
          <TextInput label="Location" placeholder="Zoom, Google Meet, office…" leftSection={<IconMapPin size={16} />} {...form.getInputProps('location')} />
          <MultiSelect
            label="Attendees"
            placeholder="Invite teammates"
            data={users.map((u) => ({ value: u.id, label: u.name }))}
            searchable
            clearable
            {...form.getInputProps('attendees')}
          />
          <Select
            label="Contact"
            data={(contactsData?.items || []).map((c) => ({ value: c._id, label: `${c.firstName} ${c.lastName || ''}`.trim() }))}
            searchable
            clearable
            {...form.getInputProps('contact')}
          />
          <Group grow>
            <Select label="Company" data={(companiesData?.items || []).map((c) => ({ value: c._id, label: c.name }))} searchable clearable {...form.getInputProps('company')} />
            <Select label="Deal" data={deals.map((d) => ({ value: d._id, label: d.title }))} searchable clearable {...form.getInputProps('deal')} />
          </Group>
          <Textarea label="Agenda / notes" minRows={3} autosize {...form.getInputProps('description')} />
          {isEdit && (
            <Select
              label="Status"
              data={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              allowDeselect={false}
              {...form.getInputProps('status')}
            />
          )}
          <Group justify="space-between" mt="sm">
            {isEdit ? (
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => confirmDelete({ message: `Delete "${event.title}"?`, onConfirm: () => remove.mutate() })}
              >
                Delete
              </Button>
            ) : <span />}
            <Group>
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{isEdit ? 'Save changes' : 'Schedule'}</Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
