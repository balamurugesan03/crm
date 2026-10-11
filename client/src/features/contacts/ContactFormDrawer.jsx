import { Stack, TextInput, Button, Group, Select, TagsInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';
import { CustomFieldInputs } from '../../components/CustomFields.jsx';

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', jobTitle: '', company: null, tags: [], customFields: {} };

export function ContactFormDrawer({ opened, onClose, contact }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(contact);

  const { data: companiesData } = useQuery({
    queryKey: ['companies', { forSelect: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: opened,
  });
  const companyOptions = (companiesData?.items || []).map((c) => ({ value: c._id, label: c.name }));

  const form = useForm({
    initialValues: EMPTY,
    validate: { firstName: (v) => (v.trim() ? null : 'First name is required') },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(
        contact
          ? { ...EMPTY, ...contact, company: contact.company?._id || contact.company || null }
          : EMPTY,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, contact]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? contactsApi.update(contact._id, values) : contactsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: isEdit ? 'Contact updated' : 'Contact created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit contact' : 'New contact'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <Group grow>
            <TextInput label="First name" required {...form.getInputProps('firstName')} />
            <TextInput label="Last name" {...form.getInputProps('lastName')} />
          </Group>
          <TextInput label="Email" type="email" {...form.getInputProps('email')} />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
          <TextInput label="Job title" {...form.getInputProps('jobTitle')} />
          <Select
            label="Company"
            placeholder="Select a company"
            data={companyOptions}
            searchable
            clearable
            {...form.getInputProps('company')}
          />
          <TagsInput label="Tags" placeholder="Add tags" {...form.getInputProps('tags')} />
          <CustomFieldInputs entity="Contact" value={form.values.customFields} onChange={(v) => form.setFieldValue('customFields', v)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create contact'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
