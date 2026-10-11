import { Stack, TextInput, Textarea, Button, Group, Select } from '@mantine/core';
import { GST_STATE_OPTIONS, GSTIN_RE } from '../../utils/gstStates.js';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { companiesApi } from '../../api/companiesApi.js';
import { CustomFieldInputs } from '../../components/CustomFields.jsx';

const EMPTY = { name: '', domain: '', industry: '', phone: '', address: '', gstin: '', stateCode: null, notes: '', customFields: {} };

export function CompanyFormDrawer({ opened, onClose, company }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(company);

  const form = useForm({
    initialValues: EMPTY,
    validate: { name: (v) => (v.trim() ? null : 'Company name is required') },
  });

  useEffect(() => {
    if (opened) form.setValues(company ? { ...EMPTY, ...company } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, company]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? companiesApi.update(company._id, values) : companiesApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: isEdit ? 'Company updated' : 'Company created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit company' : 'New company'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label="Company name" required {...form.getInputProps('name')} />
          <TextInput label="Domain" placeholder="acme.com" {...form.getInputProps('domain')} />
          <TextInput label="Industry" {...form.getInputProps('industry')} />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
          <TextInput label="Address" {...form.getInputProps('address')} />
          <Group grow align="flex-start">
            <TextInput
              label="GSTIN"
              placeholder="29ABCDE1234F1Z5"
              {...form.getInputProps('gstin')}
              onChange={(e) => {
                const v = e.currentTarget.value.toUpperCase();
                form.setFieldValue('gstin', v);
                if (GSTIN_RE.test(v)) form.setFieldValue('stateCode', v.slice(0, 2));
              }}
              error={form.values.gstin && !GSTIN_RE.test(form.values.gstin) ? 'Invalid GSTIN' : null}
            />
            <Select label="State" data={GST_STATE_OPTIONS} searchable clearable {...form.getInputProps('stateCode')} />
          </Group>
          <Textarea label="Notes" minRows={3} {...form.getInputProps('notes')} />
          <CustomFieldInputs entity="Company" value={form.values.customFields} onChange={(v) => form.setFieldValue('customFields', v)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create company'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
