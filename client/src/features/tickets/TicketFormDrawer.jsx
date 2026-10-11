import { Stack, TextInput, Textarea, Button, Group, Select, Tabs, Text, Paper } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { ActivityTimeline } from '../../components/ActivityTimeline.jsx';
import { AttachmentsPanel } from '../../components/AttachmentsPanel.jsx';
import { ticketsApi } from '../../api/ticketsApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';
import { usersApi } from '../../api/usersApi.js';

const EMPTY = { subject: '', description: '', status: 'open', priority: 'medium', contact: null, company: null, assignedTo: null };
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TicketFormDrawer({ opened, onClose, ticket }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(ticket);
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');

  const { data: fullTicket } = useQuery({
    queryKey: ['tickets', ticket?._id],
    queryFn: () => ticketsApi.get(ticket._id),
    enabled: opened && isEdit,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { forSelect: true }],
    queryFn: () => contactsApi.list({ limit: 100 }),
    enabled: opened,
  });
  const { data: companiesData } = useQuery({
    queryKey: ['companies', { forSelect: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: opened,
  });
  const { data: users } = useQuery({ queryKey: ['team'], queryFn: usersApi.list, enabled: opened });

  const contactOptions = (contactsData?.items || []).map((c) => ({ value: c._id, label: `${c.firstName} ${c.lastName || ''}`.trim() }));
  const companyOptions = (companiesData?.items || []).map((c) => ({ value: c._id, label: c.name }));
  const userOptions = (users || []).map((u) => ({ value: u.id, label: u.name }));

  const form = useForm({
    initialValues: EMPTY,
    validate: { subject: (v) => (v.trim() ? null : 'Subject is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        ticket
          ? {
              ...EMPTY,
              ...ticket,
              contact: ticket.contact?._id || ticket.contact || null,
              company: ticket.company?._id || ticket.company || null,
              assignedTo: ticket.assignedTo?._id || ticket.assignedTo || null,
            }
          : EMPTY,
      );
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, ticket]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? ticketsApi.update(ticket._id, values) : ticketsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      notifications.show({ message: isEdit ? 'Ticket updated' : 'Ticket created', color: 'teal' });
      onClose();
    },
  });

  const replyMutation = useMutation({
    mutationFn: (body) => ticketsApi.reply(ticket._id, body),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      notifications.show({ message: 'Reply sent to the customer', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not send reply', color: 'red' }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (body) => ticketsApi.addNote(ticket._id, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['tickets', ticket._id] });
      notifications.show({ message: 'Note added', color: 'teal' });
    },
  });

  const detailsForm = (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack>
        <TextInput label="Subject" required {...form.getInputProps('subject')} />
        <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />
        <Group grow>
          <Select label="Status" data={STATUS_OPTIONS} allowDeselect={false} {...form.getInputProps('status')} />
          <Select label="Priority" data={PRIORITY_OPTIONS} allowDeselect={false} {...form.getInputProps('priority')} />
        </Group>
        <Select label="Contact" data={contactOptions} searchable clearable {...form.getInputProps('contact')} />
        <Select label="Company" data={companyOptions} searchable clearable {...form.getInputProps('company')} />
        <Select label="Assign to" placeholder="Me" data={userOptions} searchable clearable {...form.getInputProps('assignedTo')} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create ticket'}</Button>
        </Group>
      </Stack>
    </form>
  );

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? `Edit ${ticket.ticketNumber}` : 'New ticket'}>
      {isEdit ? (
        <Tabs defaultValue="details">
          <Tabs.List mb="md">
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="conversation">Conversation{fullTicket?.replies?.length ? ` (${fullTicket.replies.length})` : ''}</Tabs.Tab>
            <Tabs.Tab value="activity">Internal notes</Tabs.Tab>
            <Tabs.Tab value="files">Files</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="details">{detailsForm}</Tabs.Panel>
          <Tabs.Panel value="conversation">
            <Stack gap="sm">
              <Text size="xs" c="dimmed">Visible to the customer in their portal{fullTicket?.contact ? ' and emailed when SMTP is set up' : ''}.</Text>
              {fullTicket?.description && (
                <Paper p="sm" withBorder bg="var(--app-subtle)"><Text size="xs" fw={700} c="dimmed">Original request{fullTicket.channel === 'portal' ? ' · via portal' : ''}</Text><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{fullTicket.description}</Text></Paper>
              )}
              {(fullTicket?.replies || []).map((r) => (
                <Group key={r._id} justify={r.author === 'agent' ? 'flex-end' : 'flex-start'}>
                  <Paper p="xs" px="sm" maw="85%" radius="md" withBorder={r.author !== 'agent'} style={r.author === 'agent' ? { background: 'var(--mantine-color-indigo-light)' } : undefined}>
                    <Text size="xs" fw={700}>{r.author === 'agent' ? r.name : `${r.name} (customer)`}</Text>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</Text>
                    <Text size="10px" c="dimmed">{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                  </Paper>
                </Group>
              ))}
              <Textarea placeholder="Reply to the customer…" minRows={2} autosize value={reply} onChange={(e) => setReply(e.currentTarget.value)} />
              <Group justify="flex-end">
                <Button size="xs" disabled={!reply.trim()} loading={replyMutation.isPending} onClick={() => replyMutation.mutate(reply)}>Send reply</Button>
              </Group>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="activity">
            <Stack gap="sm">
              <Textarea
                placeholder="Log a note about this ticket..."
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button size="xs" disabled={!note.trim()} loading={addNoteMutation.isPending} onClick={() => addNoteMutation.mutate(note)}>
                  Add note
                </Button>
              </Group>
              {fullTicket ? <ActivityTimeline items={fullTicket.activity} /> : <Text c="dimmed" size="sm">Loading...</Text>}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="files">
            <AttachmentsPanel entityType="Ticket" entityId={ticket._id} />
          </Tabs.Panel>
        </Tabs>
      ) : (
        detailsForm
      )}
    </FormDrawer>
  );
}
