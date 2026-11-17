import { Paper, Stack, Group, Text, Badge, Button, SimpleGrid, List, Alert, Divider } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconExternalLink } from '@tabler/icons-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { billingApi } from '../../api/billingApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { useBranding } from '../../branding/useBranding.js';

const STATUS_COLORS = { trialing: 'blue', active: 'teal', past_due: 'orange', canceled: 'red', expired: 'red' };

export function BillingTab() {
  const organization = useAuthStore((s) => s.organization);
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const branding = useBranding();
  const contact = branding.supportEmail || branding.companyName || 'your provider';

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
              <Text size="lg" fw={700} tt="capitalize">{data.currentPlan?.name || organization?.plan}</Text>
              <Badge color={STATUS_COLORS[organization?.subscriptionStatus]} variant="light" tt="capitalize">
                {organization?.subscriptionStatus?.replace('_', ' ')}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {organization?.currentPeriodEnd
                ? `Valid until ${dayjs(organization.currentPeriodEnd).format('DD MMM YYYY')}`
                : organization?.subscriptionStatus === 'active' ? 'No expiry (lifetime)' : null}
              {data.currentPlan ? ` · ${data.currentPlan.maxUsers ? `up to ${data.currentPlan.maxUsers} users` : 'unlimited users'}` : ''}
            </Text>
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

      {!data.plans.some((p) => p.checkout) && (
        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />} title="Upgrades and renewals">
          To change or renew your plan, contact {contact}{branding.supportPhone ? ` (${branding.supportPhone})` : ''}.
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
                  disabled={isCurrent || !canManage || !p.checkout}
                  loading={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate(p.plan)}
                >
                  {isCurrent ? 'Current plan' : p.checkout ? 'Upgrade' : 'Contact to upgrade'}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
