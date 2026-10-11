import { Stack, TextInput, Textarea, Button, Group, Select, NumberInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { campaignsApi } from '../../api/campaignsApi.js';

const EMPTY = { name: '', type: 'other', status: 'planned', startDate: null, endDate: null, budget: 0, description: '' };
const TYPE_OPTIONS = ['email', 'social', 'event', 'webinar', 'other'];
const STATUS_OPTIONS = ['planned', 'active', 'paused', 'completed'];

export function CampaignFormDrawer({ opened, onClose, campaign }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(campaign);

  const form = useForm({
    initialValues: EMPTY,
    validate: { name: (v) => (v.trim() ? null : 'Campaign name is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        campaign
          ? {
              ...EMPTY,
              ...campaign,
              startDate: campaign.startDate ? new Date(campaign.startDate) : null,
              endDate: campaign.endDate ? new Date(campaign.endDate) : null,
            }
          : EMPTY,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, campaign]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? campaignsApi.update(campaign._id, values) : campaignsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      notifications.show({ message: isEdit ? 'Campaign updated' : 'Campaign created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit campaign' : 'New campaign'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label="Campaign name" required {...form.getInputProps('name')} />
          <Group grow>
            <Select label="Type" data={TYPE_OPTIONS} allowDeselect={false} {...form.getInputProps('type')} />
            <Select label="Status" data={STATUS_OPTIONS} allowDeselect={false} {...form.getInputProps('status')} />
          </Group>
          <Group grow>
            <DateInput label="Start date" clearable {...form.getInputProps('startDate')} />
            <DateInput label="End date" clearable {...form.getInputProps('endDate')} />
          </Group>
          <NumberInput label="Budget" min={0} thousandSeparator="," prefix="₹" {...form.getInputProps('budget')} />
          <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create campaign'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
