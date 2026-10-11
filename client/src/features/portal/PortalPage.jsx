import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Box, Container, Group, Text, Title, Tabs, Paper, Stack, Badge, Button, Table, Modal, TextInput, Textarea, Select, Center,
  Loader, ThemeIcon, Alert, ScrollArea, Avatar, UnstyledButton,
} from '@mantine/core';
import { IconHeadset, IconReceipt, IconFileText, IconPlus, IconPrinter, IconCheck, IconX, IconLock, IconArrowLeft, IconSend } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { DocumentSheet, useUpiQr } from '../print/PrintDocumentPage.jsx';
import { formatCurrency } from '../../theme/theme.js';
import { useT, useLangStore, LANGUAGES } from '../../i18n/index.js';
import { SegmentedControl } from '@mantine/core';
import { API_BASE } from '../../utils/paths.js';

const TOKEN_KEY = 'nexus-portal-token';
const STATUS_COLOR = { partially_paid: 'yellow', open: 'blue', in_progress: 'indigo', waiting: 'orange', resolved: 'teal', closed: 'gray', sent: 'blue', paid: 'teal', overdue: 'red', accepted: 'teal', rejected: 'red', void: 'gray' };

// Token arrives in the URL fragment (never sent to servers or logs), then lives in sessionStorage.
function readToken() {
  const fromHash = window.location.hash.slice(1);
  if (fromHash) {
    try { sessionStorage.setItem(TOKEN_KEY, fromHash); } catch { /* storage unavailable */ }
    window.history.replaceState(null, '', window.location.pathname);
    return fromHash;
  }
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function usePortalClient() {
  const token = useMemo(readToken, []);
  const client = useMemo(() => axios.create({ baseURL: `${API_BASE}/portal`, headers: { 'x-portal-token': token || '' } }), [token]);
  return { token, client };
}

function Status({ value }) {
  return <Badge variant="light" color={STATUS_COLOR[value] || 'gray'} tt="capitalize">{value?.replace('_', ' ')}</Badge>;
}

function TicketThread({ client, ticketId, onBack }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const { data: ticket } = useQuery({ queryKey: ['portal-ticket', ticketId], queryFn: () => client.get(`/tickets/${ticketId}`).then((r) => r.data) });
  const send = useMutation({
    mutationFn: () => client.post(`/tickets/${ticketId}/replies`, { body: reply }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['portal-ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
    },
  });
  if (!ticket) return <Center py="xl"><Loader /></Center>;
  return (
    <Stack>
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack} px={0}>{t('portal.allRequests', 'All requests')}</Button>
        <Status value={ticket.status} />
      </Group>
      <div>
        <Text size="xs" c="dimmed" fw={600}>{ticket.ticketNumber} · opened {dayjs(ticket.createdAt).format('DD MMM YYYY')}</Text>
        <Title order={3}>{ticket.subject}</Title>
      </div>
      <Paper p="md" withBorder bg="var(--app-subtle)"><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</Text></Paper>
      {ticket.replies.map((r, i) => (
        <Group key={i} justify={r.author === 'customer' ? 'flex-end' : 'flex-start'}>
          <Paper p="sm" px="md" maw="80%" radius="lg" withBorder={r.author !== 'customer'} style={r.author === 'customer' ? { background: 'var(--mantine-color-indigo-filled)', color: 'white' } : undefined}>
            <Text size="xs" fw={700} opacity={0.8}>{r.author === 'agent' ? `${r.name} · Support` : 'You'}</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</Text>
            <Text size="10px" opacity={0.7} mt={2}>{dayjs(r.createdAt).format('DD MMM, h:mm A')}</Text>
          </Paper>
        </Group>
      ))}
      <Group align="flex-end" wrap="nowrap">
        <Textarea style={{ flex: 1 }} autosize minRows={2} placeholder={t('portal.reply', 'Write a reply…')} value={reply} onChange={(e) => setReply(e.currentTarget.value)} />
        <Button leftSection={<IconSend size={16} />} disabled={!reply.trim()} loading={send.isPending} onClick={() => send.mutate()}>{t('portal.send', 'Send')}</Button>
      </Group>
    </Stack>
  );
}

function TicketsTab({ client }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' });
  const { data: tickets = [], isLoading } = useQuery({ queryKey: ['portal-tickets'], queryFn: () => client.get('/tickets').then((r) => r.data) });
  const create = useMutation({
    mutationFn: () => client.post('/tickets', form).then((r) => r.data),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
      setNewOpen(false);
      setForm({ subject: '', description: '', priority: 'medium' });
      notifications.show({ message: `Request ${t.ticketNumber} created — we'll get back to you soon`, color: 'teal' });
      setOpenId(t._id);
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not create request', color: 'red' }),
  });

  if (openId) return <TicketThread client={client} ticketId={openId} onBack={() => setOpenId(null)} />;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>{t('portal.yourRequests', 'Your support requests')}</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setNewOpen(true)}>{t('portal.newRequest', 'New request')}</Button>
      </Group>
      {isLoading ? <Center py="xl"><Loader /></Center> : tickets.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">{t('portal.noRequests', 'No requests yet. Need help? Raise a new request.')}</Text>
      ) : (
        <Stack gap="xs">
          {tickets.map((t) => (
            <UnstyledButton key={t._id} onClick={() => setOpenId(t._id)}>
              <Paper p="md" withBorder className="hover-lift">
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>{t.subject}</Text>
                    <Text size="xs" c="dimmed">{t.ticketNumber} · updated {dayjs(t.updatedAt).format('DD MMM')} · {t.replyCount} repl{t.replyCount === 1 ? 'y' : 'ies'}</Text>
                  </div>
                  <Status value={t.status} />
                </Group>
              </Paper>
            </UnstyledButton>
          ))}
        </Stack>
      )}
      <Modal opened={newOpen} onClose={() => setNewOpen(false)} title={<Text fw={700}>{t('portal.newRequest', 'New support request')}</Text>}>
        <Stack>
          <TextInput label={t('portal.subject', 'Subject')} required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })} />
          <Textarea label={t('portal.describe', 'Describe the issue')} required autosize minRows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Select label={t('portal.priority', 'Priority')} data={['low', 'medium', 'high', 'urgent']} value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} allowDeselect={false} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewOpen(false)}>{t('portal.cancel', 'Cancel')}</Button>
            <Button loading={create.isPending} disabled={form.subject.trim().length < 3 || !form.description.trim()} onClick={() => create.mutate()}>{t('portal.submit', 'Submit')}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function DocViewer({ client, type, id, onClose }) {
  const { data } = useQuery({ queryKey: ['portal-doc', type, id], queryFn: () => client.get(`/${type}s/${id}`).then((r) => r.data), enabled: Boolean(id) });
  const { upiQr } = useUpiQr(type, data?.doc, data?.seller);
  return (
    <Modal opened={Boolean(id)} onClose={onClose} size={900} padding={0} withCloseButton={false} styles={{ body: { background: '#eef0f5' } }}>
      <Group justify="flex-end" p="sm" className="no-print" gap="xs">
        <Button size="xs" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>Print / Save PDF</Button>
        <Button size="xs" variant="default" onClick={onClose}>Close</Button>
      </Group>
      <Box p="md" style={{ colorScheme: 'light' }}>
        {data ? <DocumentSheet type={type} doc={data.doc} seller={data.seller} upiQr={upiQr} /> : <Center py="xl"><Loader /></Center>}
      </Box>
    </Modal>
  );
}

function DocsTab({ client, type }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [viewId, setViewId] = useState(null);
  const numberKey = type === 'invoice' ? 'invoiceNumber' : 'quoteNumber';
  const { data: docs = [], isLoading } = useQuery({ queryKey: ['portal-docs', type], queryFn: () => client.get(`/${type}s`).then((r) => r.data) });
  const respond = useMutation({
    mutationFn: ({ id, decision }) => client.post(`/quotes/${id}/respond`, { decision }),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['portal-docs', 'quote'] });
      notifications.show({ message: v.decision === 'accepted' ? 'Quote accepted — thank you!' : 'Quote declined', color: v.decision === 'accepted' ? 'teal' : 'gray' });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not update quote', color: 'red' }),
  });

  if (isLoading) return <Center py="xl"><Loader /></Center>;
  if (!docs.length) return <Text c="dimmed" ta="center" py="xl">No {type}s yet.</Text>;
  const unpaid = type === 'invoice' ? docs.filter((d) => ['sent', 'overdue', 'partially_paid'].includes(d.status)).reduce((s, d) => s + d.total - (d.amountPaid || 0), 0) : 0;

  return (
    <Stack>
      {unpaid > 0 && <Alert color="orange" variant="light">{t('portal.outstanding', 'Outstanding balance')}: <b>{formatCurrency(unpaid)}</b>. Open an invoice to pay instantly by UPI.</Alert>}
      <ScrollArea>
        <Table verticalSpacing="sm" miw={560} highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{type === 'invoice' ? 'Invoice' : 'Quote'}</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>{type === 'invoice' ? 'Due' : 'Valid until'}</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {docs.map((d) => (
              <Table.Tr key={d._id}>
                <Table.Td fw={600}>{d[numberKey]}</Table.Td>
                <Table.Td>{dayjs(d.issueDate || d.createdAt).format('DD MMM YYYY')}</Table.Td>
                <Table.Td>{d.dueDate || d.validUntil ? dayjs(d.dueDate || d.validUntil).format('DD MMM YYYY') : '—'}</Table.Td>
                <Table.Td fw={600}>{formatCurrency(d.total)}{d.amountPaid > 0 && d.status !== 'paid' && <Text size="xs" c="red">Due {formatCurrency(d.total - d.amountPaid)}</Text>}</Table.Td>
                <Table.Td><Status value={d.status} /></Table.Td>
                <Table.Td>
                  <Group gap={6} justify="flex-end" wrap="nowrap">
                    <Button size="xs" variant="light" onClick={() => setViewId(d._id)}>{type === 'invoice' && ['sent', 'overdue', 'partially_paid'].includes(d.status) ? t('portal.viewPay', 'View & pay') : t('portal.view', 'View')}</Button>
                    {type === 'quote' && d.status === 'sent' && (
                      <>
                        <Button size="xs" color="teal" leftSection={<IconCheck size={14} />} onClick={() => respond.mutate({ id: d._id, decision: 'accepted' })}>{t('portal.accept', 'Accept')}</Button>
                        <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => respond.mutate({ id: d._id, decision: 'rejected' })}>{t('portal.decline', 'Decline')}</Button>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <DocViewer client={client} type={type} id={viewId} onClose={() => setViewId(null)} />
    </Stack>
  );
}

export function PortalPage() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const { token, client } = usePortalClient();
  const { data: me, error, isLoading } = useQuery({ queryKey: ['portal-me'], queryFn: () => client.get('/me').then((r) => r.data), enabled: Boolean(token), retry: false });

  useEffect(() => {
    if (me) document.title = `${me.organization.name} · Customer portal`;
  }, [me]);

  if (!token || error) {
    return (
      <Center mih="100vh" p="md" style={{ background: '#f6f7fb', colorScheme: 'light' }}>
        <Paper p="xl" maw={420} ta="center" bg="white">
          <ThemeIcon size={52} radius="xl" variant="light" mx="auto" mb="sm"><IconLock size={26} /></ThemeIcon>
          <Title order={3}>{t('portal.linkInvalid', 'Link not valid')}</Title>
          <Text c="dimmed" size="sm" mt={4}>{error?.response?.data?.message || 'Open the portal from the secure link your account manager shared with you.'}</Text>
        </Paper>
      </Center>
    );
  }
  if (isLoading || !me) return <Center mih="100vh"><Loader /></Center>;

  return (
    <Box mih="100vh" style={{ background: 'var(--app-bg)' }}>
      <Box style={{ background: 'radial-gradient(800px 300px at 0% 0%, #5f62f5 0%, transparent 60%), #0f1222' }} c="white" py="xl" className="no-print">
        <Container size="md">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="#a3a9c2" fw={700} tt="uppercase">{me.organization.legalName || me.organization.name}</Text>
              <Title order={2}>{t('portal.title', 'Customer portal')}</Title>
              <Text size="sm" c="#b4b9d6">{t('portal.welcome', 'Welcome')}, {me.contact.firstName}{me.contact.company ? ` · ${me.contact.company}` : ''}</Text>
            </div>
            <Group gap="sm">
              <SegmentedControl size="xs" value={lang} onChange={setLang} data={LANGUAGES} />
              <Avatar size={44} radius="xl" color="indigo" variant="filled">{me.contact.firstName[0]}</Avatar>
            </Group>
          </Group>
        </Container>
      </Box>
      <Container size="md" py="lg">
        <Paper p="lg" shadow="xs">
          <Tabs defaultValue="tickets" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="tickets" leftSection={<IconHeadset size={16} />}>{t('portal.support', 'Support')}</Tabs.Tab>
              <Tabs.Tab value="invoices" leftSection={<IconReceipt size={16} />}>{t('portal.invoices', 'Invoices')}</Tabs.Tab>
              <Tabs.Tab value="quotes" leftSection={<IconFileText size={16} />}>{t('portal.quotes', 'Quotes')}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="tickets"><TicketsTab client={client} /></Tabs.Panel>
            <Tabs.Panel value="invoices"><DocsTab client={client} type="invoice" /></Tabs.Panel>
            <Tabs.Panel value="quotes"><DocsTab client={client} type="quote" /></Tabs.Panel>
          </Tabs>
        </Paper>
        <Text size="xs" c="dimmed" ta="center" mt="md">
          {t('portal.needHelp', 'Need help?')} {me.organization.email && <>Email {me.organization.email}</>}{me.organization.phone && <> · Call {me.organization.phone}</>} · Powered by NexusCRM
        </Text>
      </Container>
    </Box>
  );
}
