import { Stack, TextInput, Textarea, Button, Group, NumberInput, Switch, Select } from '@mantine/core';
import { GST_RATES } from '../../components/LineItemsEditor.jsx';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { productsApi } from '../../api/productsApi.js';

const EMPTY = { name: '', sku: '', description: '', price: 0, isActive: true, hsn: '', gstRate: 18 };

export function ProductFormDrawer({ opened, onClose, product }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);

  const form = useForm({
    initialValues: EMPTY,
    validate: { name: (v) => (v.trim() ? null : 'Product name is required') },
  });

  useEffect(() => {
    if (opened) form.setValues(product ? { ...EMPTY, ...product } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, product]);

  const mutation = useMutation({
    mutationFn: (values) => (isEdit ? productsApi.update(product._id, values) : productsApi.create(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notifications.show({ message: isEdit ? 'Product updated' : 'Product created', color: 'teal' });
      onClose();
    },
  });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? 'Edit product' : 'New product'}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput label="Product name" required {...form.getInputProps('name')} />
          <TextInput label="SKU" {...form.getInputProps('sku')} />
          <NumberInput label="Price (excl. GST)" min={0} thousandSeparator="," prefix="₹" {...form.getInputProps('price')} />
          <Group grow>
            <TextInput label="HSN / SAC code" placeholder="998314" {...form.getInputProps('hsn')} />
            <Select
              label="GST rate"
              data={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
              value={String(form.values.gstRate ?? 18)}
              onChange={(v) => form.setFieldValue('gstRate', Number(v))}
              allowDeselect={false}
            />
          </Group>
          <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />
          <Switch label="Active" checked={form.values.isActive} onChange={(e) => form.setFieldValue('isActive', e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create product'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
