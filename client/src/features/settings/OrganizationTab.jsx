import { useEffect } from 'react';
import {
  Paper, Stack, TextInput, Button, Group, Text, Badge, NumberInput, SegmentedControl, Switch, Select, SimpleGrid, Textarea,
  Title, Divider, MultiSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { organizationApi } from '../../api/organizationApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { GST_STATE_OPTIONS, GSTIN_RE } from '../../utils/gstStates.js';

const BILLING_FIELDS = ['legalName', 'gstin', 'pan', 'stateCode', 'address', 'city', 'pincode', 'phone', 'email', 'upiId', 'bankName', 'bankAccount', 'ifsc', 'invoiceTerms'];

function initialValues(org) {
  return {
    name: org?.name || '',
    settings: {
      rottingDays: org?.settings?.rottingDays ?? 7,
      recordVisibility: org?.settings?.recordVisibility || 'all',
      dailyDigest: org?.settings?.dailyDigest ?? true,
      autoReminders: org?.settings?.autoReminders ?? false,
      reminderBeforeDays: org?.settings?.reminderBeforeDays ?? 3,
      reminderAfterDays: (org?.settings?.reminderAfterDays || [1, 7, 15]).map(String),
    },
    billingProfile: Object.fromEntries(BILLING_FIELDS.map((k) => [k, org?.billingProfile?.[k] || ''])),
  };
}

function Section({ title, description, children }) {
  return (
    <Paper p="lg">
      <Title order={4}>{title}</Title>
      {description && <Text size="sm" c="dimmed" mb="md">{description}</Text>}
      {children}
    </Paper>
  );
}

export function OrganizationTab() {
  const organization = useAuthStore((s) => s.organization);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const form = useForm({
    initialValues: initialValues(organization),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Organization name is required'),
      billingProfile: {
        gstin: (v) => (!v || GSTIN_RE.test(v.toUpperCase()) ? null : 'Invalid GSTIN (e.g. 33ABCDE1234F1Z5)'),
        pan: (v) => (!v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase()) ? null : 'Invalid PAN'),
        pincode: (v) => (!v || /^\d{6}$/.test(v) ? null : '6-digit pincode'),
        upiId: (v) => (!v || /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(v) ? null : 'Invalid UPI ID (e.g. business@okhdfcbank)'),
        ifsc: (v) => (!v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()) ? null : 'Invalid IFSC'),
        email: (v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      },
    },
  });

  useEffect(() => {
    if (organization) form.setValues(initialValues(organization));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?._id, organization?.updatedAt]);

  // GSTIN's first two digits are the state code — fill it in automatically.
  useEffect(() => {
    const gstin = form.values.billingProfile.gstin?.toUpperCase();
    if (GSTIN_RE.test(gstin || '') && form.values.billingProfile.stateCode !== gstin.slice(0, 2)) {
      form.setFieldValue('billingProfile.stateCode', gstin.slice(0, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.billingProfile.gstin]);

  const mutation = useMutation({
    mutationFn: organizationApi.update,
    onSuccess: (updatedOrg) => {
      setSession({ user, organization: updatedOrg, accessToken });
      notifications.show({ message: 'Workspace settings saved', color: 'teal' });
    },
    onError: (err) => {
      const details = err?.response?.data?.details;
      notifications.show({ message: details?.[0] ? `${details[0].path}: ${details[0].message}` : 'Could not save', color: 'red' });
    },
  });

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        mutation.mutate({
          ...values,
          settings: { ...values.settings, reminderAfterDays: values.settings.reminderAfterDays.map(Number).sort((a, b) => a - b) },
          // Cleared selects give null; the API treats '' as "not set".
          billingProfile: Object.fromEntries(Object.entries(values.billingProfile).map(([k, v]) => [k, v ?? ''])),
        }),
      )}
    >
      <Stack maw={860}>
        <Section title="Workspace">
          <Group align="flex-end">
            <TextInput label="Organization name" disabled={!canManage} style={{ flex: 1 }} {...form.getInputProps('name')} />
            <Badge variant="light" color="indigo" tt="capitalize" size="lg" mb={4}>{organization?.plan || 'trial'} plan</Badge>
          </Group>
        </Section>

        <Section title="Sales rules" description="How NexusCRM watches your pipeline and who can see what.">
          <Stack>
            <NumberInput
              label="Flag a deal as rotting after"
              description="Open deals with no notes, meetings, stage moves or completed tasks for this long are highlighted in red."
              suffix=" days without activity"
              min={1}
              max={90}
              maw={360}
              disabled={!canManage}
              {...form.getInputProps('settings.rottingDays')}
            />
            <div>
              <Text size="sm" fw={500}>Record visibility for sales reps</Text>
              <Text size="xs" c="dimmed" mb={6}>Owners, admins and managers always see everything.</Text>
              <SegmentedControl
                disabled={!canManage}
                data={[
                  { value: 'all', label: 'Everyone sees all records' },
                  { value: 'own', label: 'Reps see only their own' },
                ]}
                {...form.getInputProps('settings.recordVisibility')}
              />
            </div>
            <Switch
              label="Daily morning digest"
              description="Each teammate gets a 9 AM notification with today's meetings, rotting deals and overdue tasks."
              disabled={!canManage}
              {...form.getInputProps('settings.dailyDigest', { type: 'checkbox' })}
            />
          </Stack>
        </Section>

        <Section title="Payment reminders" description="Automatically email customers about unpaid invoices (uses your SMTP from Settings → Integrations).">
          <Stack>
            <Switch
              label="Send automatic reminders"
              disabled={!canManage || !organization?.integrations?.smtp?.hasPassword}
              description={organization?.integrations?.smtp?.hasPassword ? 'Sent at 9 AM to the invoice contact' : 'Connect SMTP first'}
              {...form.getInputProps('settings.autoReminders', { type: 'checkbox' })}
            />
            <Group grow align="flex-start">
              <NumberInput label="Days before due date" min={0} max={30} disabled={!canManage || !form.values.settings.autoReminders} {...form.getInputProps('settings.reminderBeforeDays')} />
              <MultiSelect
                label="Days after due date"
                data={['1', '3', '7', '10', '15', '21', '30', '45', '60']}
                maxValues={6}
                disabled={!canManage || !form.values.settings.autoReminders}
                {...form.getInputProps('settings.reminderAfterDays')}
              />
            </Group>
          </Stack>
        </Section>

        <Section title="Business & GST profile" description="Printed on quotes and tax invoices. GSTIN decides CGST+SGST vs IGST automatically.">
          <Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Legal business name" disabled={!canManage} {...form.getInputProps('billingProfile.legalName')} />
              <TextInput
                label="GSTIN"
                placeholder="33ABCDE1234F1Z5"
                disabled={!canManage}
                {...form.getInputProps('billingProfile.gstin')}
                onChange={(e) => form.setFieldValue('billingProfile.gstin', e.currentTarget.value.toUpperCase())}
              />
              <TextInput label="PAN" disabled={!canManage} {...form.getInputProps('billingProfile.pan')} onChange={(e) => form.setFieldValue('billingProfile.pan', e.currentTarget.value.toUpperCase())} />
              <Select label="State (place of supply)" data={GST_STATE_OPTIONS} searchable clearable disabled={!canManage} {...form.getInputProps('billingProfile.stateCode')} />
            </SimpleGrid>
            <Textarea label="Address" autosize minRows={2} disabled={!canManage} {...form.getInputProps('billingProfile.address')} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput label="City" disabled={!canManage} {...form.getInputProps('billingProfile.city')} />
              <TextInput label="Pincode" disabled={!canManage} {...form.getInputProps('billingProfile.pincode')} />
              <TextInput label="Phone" disabled={!canManage} {...form.getInputProps('billingProfile.phone')} />
            </SimpleGrid>
            <TextInput label="Billing email" disabled={!canManage} {...form.getInputProps('billingProfile.email')} />
            <Divider label="Payment details" labelPosition="left" />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="UPI ID" description="Adds a scan-to-pay UPI QR code on invoices" placeholder="business@okhdfcbank" disabled={!canManage} {...form.getInputProps('billingProfile.upiId')} />
              <TextInput label="Bank name" disabled={!canManage} {...form.getInputProps('billingProfile.bankName')} />
              <TextInput label="Account number" disabled={!canManage} {...form.getInputProps('billingProfile.bankAccount')} />
              <TextInput label="IFSC" disabled={!canManage} {...form.getInputProps('billingProfile.ifsc')} onChange={(e) => form.setFieldValue('billingProfile.ifsc', e.currentTarget.value.toUpperCase())} />
            </SimpleGrid>
            <Textarea label="Default invoice terms" autosize minRows={2} placeholder="Payment due within 15 days. Interest @18% p.a. on delayed payments." disabled={!canManage} {...form.getInputProps('billingProfile.invoiceTerms')} />
          </Stack>
        </Section>

        {canManage && (
          <Group justify="flex-end">
            <Button type="submit" loading={mutation.isPending}>Save settings</Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}
