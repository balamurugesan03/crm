import { useEffect } from 'react';
import { Stack, TextInput, PasswordInput, Select, Switch, Button, Divider, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { adminApi, apiError } from '../../api/adminApi.js';
import { SettlementFields, EMPTY_SETTLEMENT, settlementPayload } from './SettlementFields.jsx';

const INITIAL = { name: '', ownerName: '', ownerEmail: '', ownerPassword: '', plan: 'trial', recordPayment: false, settlement: EMPTY_SETTLEMENT };

export function CreateOrganizationDrawer({ opened, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ['admin-plans'], queryFn: adminApi.listPlans, enabled: opened });

  const form = useForm({
    initialValues: INITIAL,
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Organization name is required'),
      ownerName: (v) => (v.trim().length >= 2 ? null : 'Owner name is required'),
      ownerEmail: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      ownerPassword: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
    },
  });

  useEffect(() => {
    if (opened) form.setValues({ ...INITIAL, settlement: { ...EMPTY_SETTLEMENT, paidAt: new Date() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const plan = plans.find((p) => p.key === form.values.plan);

  // Pre-fill the amount with the plan price when the plan changes.
  useEffect(() => {
    if (plan) form.setFieldValue('settlement.amount', plan.price || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.key]);

  const mutation = useMutation({
    mutationFn: ({ recordPayment, settlement, ...values }) =>
      adminApi.createOrganization({ ...values, settlement: recordPayment ? settlementPayload(settlement) : undefined }),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      notifications.show({ message: `${org.name} created. Share the owner's login details with them.`, color: 'teal' });
      onClose();
      onCreated?.(org);
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not create organization'), color: 'red' }),
  });

  const planOptions = plans
    .filter((p) => p.isActive || p.key === form.values.plan)
    .map((p) => ({ value: p.key, label: `${p.name} — ${p.priceLabel}` }));

  return (
    <FormDrawer opened={opened} onClose={onClose} title="New organization" size={520}>
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <TextInput label="Organization name" placeholder="Acme Traders" required {...form.getInputProps('name')} />
          <Divider label="Owner login" labelPosition="left" />
          <TextInput label="Owner name" required {...form.getInputProps('ownerName')} />
          <TextInput label="Owner email" placeholder="owner@acme.com" required {...form.getInputProps('ownerEmail')} />
          <PasswordInput label="Temporary password" description="The owner can change it under Settings → Profile" required {...form.getInputProps('ownerPassword')} />
          <Divider label="Subscription" labelPosition="left" />
          <Select label="Plan" data={planOptions} allowDeselect={false} {...form.getInputProps('plan')} />
          {plan?.billingCycle !== 'free' && (
            <Switch label="Payment already received — record a settlement" {...form.getInputProps('recordPayment', { type: 'checkbox' })} />
          )}
          {form.values.recordPayment && plan?.billingCycle !== 'free' && <SettlementFields form={form} prefix="settlement" plan={plan} />}
          {!form.values.recordPayment && plan && plan.billingCycle !== 'free' && (
            <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
              The workspace starts active with no end date. Record a settlement later from the organization page.
            </Alert>
          )}
          <Button type="submit" loading={mutation.isPending}>Create organization</Button>
        </Stack>
      </form>
    </FormDrawer>
  );
}
