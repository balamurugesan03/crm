import { useEffect, useState } from 'react';
import {
  Button, Paper, SimpleGrid, Stack, Group, Text, Badge, List, ActionIcon, Menu, TextInput, Textarea, Select,
  NumberInput, Switch, Center, Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconDotsVertical, IconPencil, IconTrash, IconCheck } from '@tabler/icons-react';

import { PageHeader } from '../components/PageHeader.jsx';
import { FormDrawer } from '../components/FormDrawer.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { confirmDelete } from '../components/confirmDelete.js';
import { adminApi, BILLING_CYCLE_LABELS, apiError } from '../api/adminApi.js';

const CYCLE_OPTIONS = Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => ({ value, label }));
const CYCLE_COLORS = { free: 'gray', monthly: 'blue', quarterly: 'cyan', yearly: 'indigo', one_time: 'grape' };

const EMPTY = { key: '', name: '', description: '', billingCycle: 'monthly', price: 0, maxUsers: 5, features: '', isActive: true, sortOrder: 0 };

function PlanDrawer({ plan, opened, onClose }) {
  const queryClient = useQueryClient();
  const editing = Boolean(plan?._id);
  const form = useForm({
    initialValues: EMPTY,
    validate: {
      key: (v) => (editing || /^[a-z0-9_-]{2,30}$/.test(v) ? null : '2-30 lowercase letters, numbers, - or _'),
      name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  // Load the chosen plan (or a blank one) each time the drawer opens.
  useEffect(() => {
    if (!opened) return;
    form.setValues(plan ? { ...EMPTY, ...plan, features: (plan.features || []).join('\n') } : EMPTY);
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, plan?._id]);

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = { ...values, features: values.features.split('\n').map((f) => f.trim()).filter(Boolean) };
      return editing ? adminApi.updatePlan(plan._id, payload) : adminApi.createPlan(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      notifications.show({ message: editing ? 'Plan updated' : 'Plan created', color: 'teal' });
      onClose();
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not save plan'), color: 'red' }),
  });

  const lifetime = form.values.billingCycle === 'one_time';

  return (
    <FormDrawer opened={opened} onClose={onClose} title={editing ? `Edit ${plan.name}` : 'New subscription plan'} size={460}>
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack>
          <TextInput label="Plan name" placeholder="Gold" required {...form.getInputProps('name')} />
          <TextInput
            label="Plan key"
            description={editing ? 'Fixed after creation' : 'Short ID stored on organizations, e.g. gold'}
            disabled={editing}
            required
            {...form.getInputProps('key')}
            onChange={(e) => form.setFieldValue('key', e.currentTarget.value.toLowerCase())}
          />
          <Select label="Billing" data={CYCLE_OPTIONS} allowDeselect={false} {...form.getInputProps('billingCycle')} />
          {form.values.billingCycle !== 'free' && (
            <NumberInput
              label={lifetime ? 'One-time settlement amount (₹)' : 'Price per cycle (₹)'}
              description={lifetime ? 'Paid once. The workspace never expires.' : '0 shows as "Contact us"'}
              min={0}
              thousandSeparator=","
              {...form.getInputProps('price')}
            />
          )}
          <NumberInput label="Max active users" description="0 = unlimited" min={0} {...form.getInputProps('maxUsers')} />
          <Textarea label="Description" autosize minRows={2} {...form.getInputProps('description')} />
          <Textarea label="Features" description="One per line" autosize minRows={3} {...form.getInputProps('features')} />
          <NumberInput label="Display order" min={0} {...form.getInputProps('sortOrder')} />
          <Switch label="Active (offered to organizations)" {...form.getInputProps('isActive', { type: 'checkbox' })} />
          <Button type="submit" loading={mutation.isPending}>{editing ? 'Save plan' : 'Create plan'}</Button>
        </Stack>
      </form>
    </FormDrawer>
  );
}

export function PlansPage() {
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState({ opened: false, plan: null });
  const { data: plans, isLoading } = useQuery({ queryKey: ['admin-plans'], queryFn: adminApi.listPlans });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      notifications.show({ message: 'Plan deleted', color: 'teal' });
    },
    onError: (err) => notifications.show({ message: apiError(err, 'Could not delete plan'), color: 'red' }),
  });

  return (
    <>
      <PageHeader
        title="Subscription plans"
        subtitle="Monthly, yearly or one-time (lifetime) plans you sell to organizations"
        action={<Button leftSection={<IconPlus size={16} />} onClick={() => setDrawer({ opened: true, plan: null })}>New plan</Button>}
      />

      {isLoading ? (
        <Center h={240}><Loader color="dark" /></Center>
      ) : !plans?.length ? (
        <EmptyState title="No plans yet" description="Create your first subscription plan." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {plans.map((p) => (
            <Paper key={p._id} p="lg" style={{ opacity: p.isActive ? 1 : 0.6 }}>
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap={8}>
                    <Text fw={700} size="lg">{p.name}</Text>
                    {!p.isActive && <Badge color="gray" variant="light">Inactive</Badge>}
                  </Group>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={16} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setDrawer({ opened: true, plan: p })}>Edit</Menu.Item>
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() =>
                          confirmDelete({
                            title: `Delete the ${p.name} plan?`,
                            message: 'Only plans no organization is using can be deleted.',
                            onConfirm: () => deleteMutation.mutate(p._id),
                          })
                        }
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                <Group gap={6}>
                  <Badge color={CYCLE_COLORS[p.billingCycle]} variant="light">{BILLING_CYCLE_LABELS[p.billingCycle]}</Badge>
                  <Badge color="dark" variant="outline">{p.key}</Badge>
                </Group>
                <Text size="xl" fw={800}>{p.priceLabel}</Text>
                <Text size="sm" c="dimmed">
                  {p.maxUsers ? `Up to ${p.maxUsers} users` : 'Unlimited users'} · {p.organizationCount} organization{p.organizationCount === 1 ? '' : 's'}
                </Text>
                {p.description && <Text size="sm">{p.description}</Text>}
                {p.features?.length > 0 && (
                  <List spacing={2} size="sm" icon={<IconCheck size={14} color="var(--mantine-color-teal-6)" />}>
                    {p.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
                  </List>
                )}
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <PlanDrawer opened={drawer.opened} plan={drawer.plan} onClose={() => setDrawer({ opened: false, plan: null })} />
    </>
  );
}
