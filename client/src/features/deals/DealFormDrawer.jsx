import { Stack, TextInput, Button, Group, Select, NumberInput, Tabs, Textarea, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { ActivityTimeline } from '../../components/ActivityTimeline.jsx';
import { RelatedTasksPanel } from '../../components/RelatedTasksPanel.jsx';
import { AiInsightsPanel } from '../ai/AiInsightsPanel.jsx';
import { MessagesPanel } from '../messaging/MessagesPanel.jsx';
import { AttachmentsPanel } from '../../components/AttachmentsPanel.jsx';
import { dealsApi } from '../../api/dealsApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';
import { CustomFieldInputs } from '../../components/CustomFields.jsx';

const EMPTY = { title: '', amount: 0, stage: null, contact: null, company: null, expectedCloseDate: null, customFields: {} };

export function DealFormDrawer({ opened, onClose, deal, stages, defaultStageId }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(deal);
  const [note, setNote] = useState('');

  const { data: fullDeal } = useQuery({
    queryKey: ['deals', deal?._id],
    queryFn: () => dealsApi.get(deal._id),
    enabled: opened && isEdit,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { forSelect: true }],
    queryFn: () => contactsApi.list({ limit: 100 }),
    enabled: opened,
  });
  const { data: companiesData } = useQuery({
    queryKey: ['companies', { forSelect: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: opened,
  });

  const contactOptions = (contactsData?.items || []).map((c) => ({ value: c._id, label: `${c.firstName} ${c.lastName || ''}`.trim() }));
  const companyOptions = (companiesData?.items || []).map((c) => ({ value: c._id, label: c.name }));
  const stageOptions = (stages || []).map((s) => ({ value: s._id, label: s.name }));

  const form = useForm({
    initialValues: EMPTY,
    validate: { title: (v) => (v.trim() ? null : 'Deal title is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        deal
          ? {
              ...EMPTY,
              ...deal,
              stage: deal.stage?._id || deal.stage,
              contact: deal.contact?._id || deal.contact || null,
              company: deal.company?._id || deal.company || null,
              expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
            }
          : { ...EMPTY, stage: defaultStageId || stages?.[0]?._id || null },
      );
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, deal]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? dealsApi.update(deal._id, values) : dealsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: isEdit ? 'Deal updated' : 'Deal created', color: 'teal' });
      onClose();
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (body) => dealsApi.addNote(deal._id, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['deals', deal._id] });
      notifications.show({ message: 'Note added', color: 'teal' });
    },
  });

  const detailsForm = (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack>
        <TextInput label="Deal title" required {...form.getInputProps('title')} />
        <NumberInput label="Amount" min={0} thousandSeparator="," prefix="₹" {...form.getInputProps('amount')} />
        <Select label="Stage" data={stageOptions} {...form.getInputProps('stage')} />
        <Select label="Contact" data={contactOptions} searchable clearable {...form.getInputProps('contact')} />
        <Select label="Company" data={companyOptions} searchable clearable {...form.getInputProps('company')} />
        <DateInput label="Expected close date" clearable {...form.getInputProps('expectedCloseDate')} />
        <CustomFieldInputs entity="Deal" value={form.values.customFields} onChange={(v) => form.setFieldValue('customFields', v)} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create deal'}</Button>
        </Group>
      </Stack>
    </form>
  );

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit deal' : 'New deal'}>
      {isEdit ? (
        <Tabs defaultValue="details">
          <Tabs.List mb="md">
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="activity">Activity</Tabs.Tab>
            <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
            <Tabs.Tab value="messages">Messages</Tabs.Tab>
            <Tabs.Tab value="files">Files</Tabs.Tab>
            <Tabs.Tab value="ai" color="grape">✨ AI</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="details">{detailsForm}</Tabs.Panel>
          <Tabs.Panel value="activity">
            <Stack gap="sm">
              <Textarea
                placeholder="Log a note about this deal..."
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button size="xs" disabled={!note.trim()} loading={addNoteMutation.isPending} onClick={() => addNoteMutation.mutate(note)}>
                  Add note
                </Button>
              </Group>
              {fullDeal ? <ActivityTimeline items={fullDeal.activity} /> : <Text c="dimmed" size="sm">Loading...</Text>}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="tasks">
            <RelatedTasksPanel relatedToModel="Deal" relatedToId={deal._id} relatedToLabel={deal.title} />
          </Tabs.Panel>
          <Tabs.Panel value="messages">
            <MessagesPanel entityType="Deal" entityId={deal._id} />
          </Tabs.Panel>
          <Tabs.Panel value="files">
            <AttachmentsPanel entityType="Deal" entityId={deal._id} />
          </Tabs.Panel>
          <Tabs.Panel value="ai">
            <AiInsightsPanel entityType="Deal" entityId={deal._id} />
          </Tabs.Panel>
        </Tabs>
      ) : (
        detailsForm
      )}
    </FormDrawer>
  );
}
