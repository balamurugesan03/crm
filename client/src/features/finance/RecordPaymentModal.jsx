import { useEffect, useState } from 'react';
import {
  Modal, Stack, Group, NumberInput, Select, TextInput, Textarea, Button, Text, Paper, Divider, ActionIcon, Tooltip, Badge, SimpleGrid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconReceipt } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { financeApi, PAYMENT_MODES, MODE_LABEL } from './financeApi.js';
import { confirmDelete } from '../../components/confirmDelete.js';
import { formatCurrency } from '../../theme/theme.js';
import { useAuthStore } from '../../store/authStore.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Record a (partial) payment against an invoice and see its payment history.
export function RecordPaymentModal({ invoice, onClose }) {
  const queryClient = useQueryClient();
  const canDelete = ['owner', 'admin', 'manager'].includes(useAuthStore((s) => s.user?.role));
  const balance = invoice ? r2(invoice.total - (invoice.amountPaid || 0)) : 0;
  const [v, setV] = useState({});

  useEffect(() => {
    if (invoice) setV({ amount: balance, tds: 0, date: new Date(), mode: 'upi', reference: '', notes: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?._id]);

  const { data: payments = [] } = useQuery({
    queryKey: ['invoice-payments', invoice?._id],
    queryFn: () => financeApi.invoicePayments(invoice._id),
    enabled: Boolean(invoice),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoice?._id] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  };

  const save = useMutation({
    mutationFn: () => financeApi.recordPayment(invoice._id, { ...v, amount: Number(v.amount), tds: Number(v.tds) || 0, date: v.date }),
    onSuccess: (res) => {
      refresh();
      notifications.show({ message: `${res.payment.receiptNumber} recorded — invoice is now ${res.invoice.status.replace('_', ' ')}`, color: 'teal' });
      onClose();
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not record payment', color: 'red' }),
  });

  const remove = useMutation({
    mutationFn: financeApi.deletePayment,
    onSuccess: () => {
      refresh();
      notifications.show({ message: 'Payment deleted', color: 'gray' });
    },
  });

  const settles = r2((Number(v.amount) || 0) + (Number(v.tds) || 0));
  const over = settles > balance + 0.5;

  return (
    <Modal opened={Boolean(invoice)} onClose={onClose} size="lg" title={<Group gap="xs"><IconReceipt size={18} /><Text fw={700}>Record payment · {invoice?.invoiceNumber}</Text></Group>}>
      {invoice && (
        <Stack>
          <SimpleGrid cols={3}>
            <Paper p="sm" withBorder ta="center"><Text size="xs" c="dimmed">Invoice total</Text><Text fw={700}>{formatCurrency(invoice.total)}</Text></Paper>
            <Paper p="sm" withBorder ta="center"><Text size="xs" c="dimmed">Received</Text><Text fw={700} c="teal">{formatCurrency(invoice.amountPaid || 0)}</Text></Paper>
            <Paper p="sm" withBorder ta="center"><Text size="xs" c="dimmed">Balance due</Text><Text fw={700} c={balance ? 'red' : 'teal'}>{formatCurrency(balance)}</Text></Paper>
          </SimpleGrid>

          {balance > 0 && (
            <>
              <Group grow align="flex-start">
                <NumberInput label="Amount received" prefix="₹" thousandSeparator="," min={0} value={v.amount} onChange={(x) => setV({ ...v, amount: x })} error={over ? 'More than the balance due' : null} />
                <NumberInput label="TDS deducted" description="Tax deducted by the customer" prefix="₹" thousandSeparator="," min={0} value={v.tds} onChange={(x) => setV({ ...v, tds: x })} />
              </Group>
              <Group grow>
                <DateInput label="Payment date" value={v.date} onChange={(d) => setV({ ...v, date: d })} maxDate={new Date()} valueFormat="DD MMM YYYY" />
                <Select label="Mode" data={PAYMENT_MODES} value={v.mode} onChange={(m) => setV({ ...v, mode: m })} allowDeselect={false} />
              </Group>
              <TextInput label="Reference" placeholder="UTR / UPI ref / cheque no." value={v.reference} onChange={(e) => setV({ ...v, reference: e.currentTarget.value })} />
              <Textarea label="Notes" autosize minRows={1} value={v.notes} onChange={(e) => setV({ ...v, notes: e.currentTarget.value })} />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Settles {formatCurrency(settles)}{settles >= balance - 0.5 ? ' — invoice will be fully paid' : ''}</Text>
                <Button loading={save.isPending} disabled={!Number(v.amount) || over} onClick={() => save.mutate()}>Record payment</Button>
              </Group>
            </>
          )}

          <Divider label={`Payment history (${payments.length})`} labelPosition="left" />
          {payments.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center">No payments yet.</Text>
          ) : (
            <Stack gap={6}>
              {payments.map((p) => (
                <Group key={p._id} justify="space-between" p="xs" wrap="nowrap" style={{ borderRadius: 8, background: 'var(--app-subtle)' }}>
                  <div>
                    <Group gap={6}>
                      <Text size="sm" fw={600}>{formatCurrency(p.amount)}</Text>
                      {p.tds > 0 && <Badge size="xs" variant="light" color="grape">+ TDS {formatCurrency(p.tds)}</Badge>}
                      <Badge size="xs" variant="light">{MODE_LABEL[p.mode]}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{p.receiptNumber} · {dayjs(p.date).format('DD MMM YYYY')}{p.reference ? ` · ${p.reference}` : ''}{p.recordedBy ? ` · by ${p.recordedBy.name}` : ''}</Text>
                  </div>
                  {canDelete && (
                    <Tooltip label="Delete payment">
                      <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete({ message: `Delete ${p.receiptNumber}? The invoice balance will be reopened.`, onConfirm: () => remove.mutate(p._id) })}>
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
