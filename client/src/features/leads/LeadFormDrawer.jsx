import { Stack, TextInput, Button, Group, Select, NumberInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { leadsApi } from '../../api/leadsApi.js';
import { campaignsApi } from '../../api/campaignsApi.js';
import { CustomFieldInputs } from '../../components/CustomFields.jsx';

const EMPTY = { name: '', email: '', phone: '', source: 'other', status: 'new', estimatedValue: 0, campaign: null, customFields: {} };

const SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social' },
  { value: 'event', label: 'Event' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'other', label: 'Other' },
];
const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'converted', label: 'Converted' },
];

export function LeadFormDrawer({ opened, onClose, lead }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(lead);

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', { forSelect: true }],
    queryFn: () => campaignsApi.list({ limit: 100 }),
    enabled: opened,
  });
  const campaignOptions = (campaignsData?.items || []).map((c) => ({ value: c._id, label: c.name }));

  const form = useForm({
    initialValues: EMPTY,
    validate: { name: (v) => (v.trim() ? null : 'Name is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        lead ? { ...EMPTY, ...lead, campaign: lead.campaign?._id || lead.campaign || null } : EMPTY,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, lead]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? leadsApi.update(lead._id, values) : leadsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      notifications.show({ message: isEdit ? 'Lead updated' : 'Lead created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit lead' : 'New lead'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput label="Email" type="email" {...form.getInputProps('email')} />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
          <Select label="Source" data={SOURCE_OPTIONS} {...form.getInputProps('source')} />
          <Select label="Status" data={STATUS_OPTIONS} {...form.getInputProps('status')} />
          <Select label="Campaign" data={campaignOptions} searchable clearable {...form.getInputProps('campaign')} />
          <NumberInput
            label="Estimated value"
            min={0}
            thousandSeparator=","
            prefix="₹"
            {...form.getInputProps('estimatedValue')}
          />
          <CustomFieldInputs entity="Lead" value={form.values.customFields} onChange={(v) => form.setFieldValue('customFields', v)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create lead'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
