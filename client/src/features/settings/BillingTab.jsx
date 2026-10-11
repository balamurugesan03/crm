import { Paper, Stack, Group, Text, Badge, Button, SimpleGrid, List, Alert, Divider } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconExternalLink } from '@tabler/icons-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { billingApi } from '../../api/billingApi.js';
import { useAuthStore } from '../../store/authStore.js';

const STATUS_COLORS = { trialing: 'blue', active: 'teal', past_due: 'orange', canceled: 'red' };

export function BillingTab() {
  const organization = useAuthStore((s) => s.organization);
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const { data, isLoading } = useQuery({ queryKey: ['billing-plans'], queryFn: billingApi.getPlans });

  const checkoutMutation = useMutation({
    mutationFn: billingApi.createCheckoutSession,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err) => {
      notifications.show({ message: err?.response?.data?.message || 'Could not start checkout', color: 'red' });
    },
  });

  const portalMutation = useMutation({
    mutationFn: billingApi.createPortalSession,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err) => {
      notifications.show({ message: err?.response?.data?.message || 'Could not open billing portal', color: 'red' });
    },
  });

  if (isLoading) return null;

  return (
    <Stack gap="lg">
      <Paper p="lg">
        <Group justify="space-between">
          <div>
            <Text size="sm" c="dimmed">Current plan</Text>
            <Group gap={8} mt={4}>
              <Text size="lg" fw={700} tt="capitalize">{organization?.plan}</Text>
              <Badge color={STATUS_COLORS[organization?.subscriptionStatus]} variant="light" tt="capitalize">
                {organization?.subscriptionStatus?.replace('_', ' ')}
              </Badge>
            </Group>
            {organization?.currentPeriodEnd && (
              <Text size="xs" c="dimmed" mt={4}>
                Renews {dayjs(organization.currentPeriodEnd).format('DD MMM YYYY')}
              </Text>
            )}
          </div>
          {canManage && organization?.stripeCustomerId && (
            <Button
              variant="light"
              rightSection={<IconExternalLink size={14} />}
              loading={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              Manage billing
            </Button>
          )}
        </Group>
      </Paper>

      {!data.configured && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />} title="Billing isn't set up yet">
          Add Stripe test API keys to <code>server/.env</code> (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and a price ID per
          plan) to enable upgrades. See the README for the exact steps.
        </Alert>
      )}

      <Divider label="Plans" labelPosition="left" />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {data.plans.map((p) => {
          const isCurrent = organization?.plan === p.plan;
          return (
            <Paper key={p.plan} p="lg" withBorder shadow={isCurrent ? 'md' : 'sm'} style={isCurrent ? { borderColor: 'var(--mantine-color-indigo-5)' } : undefined}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>{p.name}</Text>
                  {isCurrent && <Badge variant="filled" color="indigo">Current</Badge>}
                </Group>
                <Text size="xl" fw={700}>{p.priceLabel}</Text>
                <List spacing={4} size="sm" icon={<IconCheck size={14} color="var(--mantine-color-teal-6)" />}>
                  {p.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
                </List>
                <Button
                  mt="sm"
                  variant={isCurrent ? 'default' : 'filled'}
                  disabled={isCurrent || !canManage || !data.configured}
                  loading={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate(p.plan)}
                >
                  {isCurrent ? 'Current plan' : 'Upgrade'}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
