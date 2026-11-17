import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Group, Stack, Title, Text, Paper, Anchor, Center, Loader, Badge, Select, Button, Avatar, ThemeIcon, Table,
  ActionIcon, Modal, NumberInput, PasswordInput, SimpleGrid, Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconArrowLeft, IconBuildingSkyscraper, IconLockPause, IconLockOpen, IconReceipt2, IconTrash, IconKey,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { adminApi, STATUS_COLORS, PAYMENT_MODE_OPTIONS, BILLING_CYCLE_LABELS, formatINR, apiError } from '../../api/adminApi.js';
import { confirmDelete } from '../../components/confirmDelete.js';
import { SettlementFields, EMPTY_SETTLEMENT, settlementPayload } from './SettlementFields.jsx';

const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired (locked)' },
];
const MODE_LABELS = Object.fromEntries(PAYMENT_MODE_OPTIONS.map((o) => [o.value, o.label]));

function SettlementModal({ org, plans, opened, onClose }) {
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: { plan: org.plan, ...EMPTY_SETTLEMENT } });
  const plan = plans.find((p) => p.key === form.values.plan);

  useEffect(() => {
    if (opened) form.setValues({ plan: org.plan, ...EMPTY_SETTLEMENT, paidAt: new Date() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);
  useEffect(() => {
    if (plan) form.setFieldValue('amount', plan.price || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.key]);

  const mutation = useMutation({
    mutationFn: (values) => adminApi.recordSettlement(org._id, settlementPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      notifications.show({ message: 'Settlement recorded — subscription updated', color: 'teal' });
      onClose();
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not record settlement'), color: 'red' }),
  });

  const planOptions = plans
    .filter((p) => p.isActive || p.key === org.plan)
    .map((p) => ({ value: p.key, label: `${p.name} — ${p.priceLabel}` }));

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={650}>Record settlement</Text>} size="lg">
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <Select label="Plan" data={planOptions} allowDeselect={false} {...form.getInputProps('plan')} />
          <SettlementFields form={form} plan={plan} />
          <Button type="submit" loading={mutation.isPending}>Record payment</Button>
        </Stack>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ orgId, user, onClose }) {
  const form = useForm({
    initialValues: { password: '' },
    validate: { password: (v) => (v.length >= 8 ? null : 'At least 8 characters') },
  });
  const mutation = useMutation({
    mutationFn: ({ password }) => adminApi.resetUserPassword(orgId, { userId: user.id, password }),
    onSuccess: () => {
      notifications.show({ message: `Password reset for ${user.email}`, color: 'teal' });
      form.reset();
      onClose();
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not reset password'), color: 'red' }),
  });
  return (
    <Modal opened={Boolean(user)} onClose={onClose} title={<Text fw={650}>Reset password — {user?.name}</Text>}>
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <PasswordInput label="New password" data-autofocus {...form.getInputProps('password')} />
          <Button type="submit" loading={mutation.isPending}>Set password</Button>
        </Stack>
      </form>
    </Modal>
  );
}

export function OrganizationDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [settling, setSettling] = useState(false);
  const [resetFor, setResetFor] = useState(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ['admin-organizations', id],
    queryFn: () => adminApi.getOrganization(id),
  });
  const { data: plans = [] } = useQuery({ queryKey: ['admin-plans'], queryFn: adminApi.listPlans });

  const updateMutation = useMutation({
    mutationFn: (payload) => adminApi.updateOrganization(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      notifications.show({ message: 'Organization updated', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Update failed'), color: 'red' }),
  });

  const deleteSettlementMutation = useMutation({
    mutationFn: (settlementId) => adminApi.deleteSettlement(id, settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      notifications.show({ message: 'Settlement deleted. Subscription dates were not changed.', color: 'teal' });
    },
  });

  if (isLoading || !org) {
    return (
      <Center h={300}>
        <Loader color="dark" />
      </Center>
    );
  }

  const plan = plans.find((p) => p.key === org.plan);
  const activeUsers = org.users.filter((u) => u.isActive).length;
  const planOptions = plans.map((p) => ({ value: p.key, label: p.isActive ? p.name : `${p.name} (inactive)` }));
  if (!plans.some((p) => p.key === org.plan)) planOptions.push({ value: org.plan, label: `${org.plan} (missing plan)` });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/admin/organizations" size="sm" c="dimmed">
        <Group gap={4}><IconArrowLeft size={14} /> Back to organizations</Group>
      </Anchor>

      <Paper p="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <ThemeIcon size={48} radius="xl" variant="light" color="dark">
              <IconBuildingSkyscraper size={22} />
            </ThemeIcon>
            <div>
              <Group gap={8}>
                <Title order={3}>{org.name}</Title>
                <Badge color={STATUS_COLORS[org.subscriptionStatus]} variant="light" tt="capitalize">
                  {org.subscriptionStatus.replace('_', ' ')}
                </Badge>
                {org.isSuspended && <Badge color="red" variant="filled">Suspended</Badge>}
              </Group>
              <Text c="dimmed" size="sm">/{org.slug} · Joined {dayjs(org.createdAt).format('DD MMM YYYY')}</Text>
              <Text size="sm" mt={4}>Total settled: {formatINR(org.revenue)}</Text>
            </div>
          </Group>

          <Group>
            <Button leftSection={<IconReceipt2 size={16} />} onClick={() => setSettling(true)}>Record settlement</Button>
            {org.isSuspended ? (
              <Button color="teal" variant="light" leftSection={<IconLockOpen size={14} />} onClick={() => updateMutation.mutate({ isSuspended: false })}>
                Reactivate
              </Button>
            ) : (
              <Button
                color="orange"
                variant="light"
                leftSection={<IconLockPause size={14} />}
                onClick={() =>
                  confirmDelete({
                    title: 'Suspend this organization?',
                    message: `Users in "${org.name}" will be unable to log in until reactivated.`,
                    confirmLabel: 'Suspend',
                    confirmColor: 'orange',
                    onConfirm: () => updateMutation.mutate({ isSuspended: true }),
                  })
                }
              >
                Suspend
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      <Paper p="lg">
        <Title order={4} mb="xs">Subscription</Title>
        <Text size="sm" c="dimmed" mb="md">
          {plan ? `${plan.name} · ${BILLING_CYCLE_LABELS[plan.billingCycle]} · ${plan.priceLabel}` : 'Plan not found'}
          {' · '}
          {org.currentPeriodEnd ? `valid until ${dayjs(org.currentPeriodEnd).format('DD MMM YYYY')}` : 'no end date (lifetime)'}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Select
            label="Plan"
            data={planOptions}
            value={org.plan}
            allowDeselect={false}
            onChange={(value) => updateMutation.mutate({ plan: value })}
          />
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={org.subscriptionStatus}
            allowDeselect={false}
            onChange={(subscriptionStatus) => updateMutation.mutate({ subscriptionStatus })}
          />
          <DateInput
            key={org.currentPeriodEnd || 'none'}
            label="Valid until"
            description="Empty = never expires"
            valueFormat="DD MMM YYYY"
            clearable
            defaultValue={org.currentPeriodEnd ? new Date(org.currentPeriodEnd) : null}
            onChange={(d) => updateMutation.mutate({ currentPeriodEnd: d ? dayjs(d).endOf('day').toISOString() : null })}
          />
          <NumberInput
            key={`limit-${org.maxUsersOverride}`}
            label="User limit override"
            description={`Plan limit: ${plan?.maxUsers ? plan.maxUsers : 'unlimited'} · empty = use plan`}
            min={0}
            placeholder="Use plan limit"
            defaultValue={org.maxUsersOverride ?? ''}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const next = raw === '' ? null : Number(raw);
              if (next !== (org.maxUsersOverride ?? null)) updateMutation.mutate({ maxUsersOverride: next });
            }}
          />
        </SimpleGrid>
      </Paper>

      <Paper p="lg">
        <Title order={4} mb="md">Settlements ({org.settlements.length})</Title>
        {org.settlements.length === 0 ? (
          <Text size="sm" c="dimmed">No payments recorded yet.</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Paid on</Table.Th>
                  <Table.Th>Plan</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Mode / ref</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {org.settlements.map((s) => (
                  <Table.Tr key={s._id}>
                    <Table.Td>{dayjs(s.paidAt).format('DD MMM YYYY')}</Table.Td>
                    <Table.Td>
                      <Text size="sm">{s.planName || s.plan}</Text>
                      <Text size="xs" c="dimmed">{BILLING_CYCLE_LABELS[s.billingCycle] || s.billingCycle}</Text>
                    </Table.Td>
                    <Table.Td fw={600}>{formatINR(s.amount)}</Table.Td>
                    <Table.Td>
                      <Text size="sm">{MODE_LABELS[s.paymentMode] || s.paymentMode}</Text>
                      {s.reference && <Text size="xs" c="dimmed">{s.reference}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {s.periodStart ? dayjs(s.periodStart).format('DD MMM YY') : '—'} → {s.periodEnd ? dayjs(s.periodEnd).format('DD MMM YY') : 'Lifetime'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Delete record">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            confirmDelete({
                              title: 'Delete this settlement?',
                              message: 'Only the payment record is removed. Adjust the plan or valid-until date yourself if needed.',
                              onConfirm: () => deleteSettlementMutation.mutate(s._id),
                            })
                          }
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Paper p="lg">
        <Title order={4} mb="md">
          Users ({activeUsers} active{org.userLimit ? ` of ${org.userLimit} allowed` : ', unlimited'})
        </Title>
        <Stack gap={0}>
          {org.users.map((u) => (
            <Group key={u.id} justify="space-between" py="sm" style={{ borderBottom: '1px solid var(--app-border)' }}>
              <Group gap={8}>
                <Avatar size={28} radius="xl" color={u.avatarColor}>{u.name?.[0]}</Avatar>
                <div>
                  <Text size="sm" fw={500}>{u.name}</Text>
                  <Text size="xs" c="dimmed">{u.email}</Text>
                </div>
              </Group>
              <Group gap="sm">
                {!u.isActive && <Badge color="gray" variant="light" size="sm">Inactive</Badge>}
                <Badge variant="light" tt="capitalize" size="sm">{u.role.replace('_', ' ')}</Badge>
                <Tooltip label="Reset password">
                  <ActionIcon variant="subtle" color="gray" onClick={() => setResetFor(u)}>
                    <IconKey size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          ))}
        </Stack>
      </Paper>

      <SettlementModal org={org} plans={plans} opened={settling} onClose={() => setSettling(false)} />
      <ResetPasswordModal orgId={org._id} user={resetFor} onClose={() => setResetFor(null)} />
    </Stack>
  );
}
