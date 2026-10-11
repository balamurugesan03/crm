import { Stack, Select, Button, Group, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { LineItemsEditor } from '../../components/LineItemsEditor.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { quotesApi } from '../../api/quotesApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'rejected'];

export function QuoteFormDrawer({ opened, onClose, quote }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(quote);

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
  const sellerState = useAuthStore((s) => s.organization?.billingProfile?.stateCode);

  const [contact, setContact] = useState(null);
  const [company, setCompany] = useState(null);
  const [status, setStatus] = useState('draft');
  const [validUntil, setValidUntil] = useState(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    if (!opened) return;
    if (quote) {
      setContact(quote.contact?._id || quote.contact || null);
      setCompany(quote.company?._id || quote.company || null);
      setStatus(quote.status || 'draft');
      setValidUntil(quote.validUntil ? new Date(quote.validUntil) : null);
      setNotes(quote.notes || '');
      setItems(quote.items?.length ? quote.items : [{ description: '', quantity: 1, unitPrice: 0 }]);
      setTaxRate(quote.taxRate || 0);
    } else {
      setContact(null);
      setCompany(null);
      setStatus('draft');
      setValidUntil(null);
      setNotes('');
      setItems([{ description: '', hsn: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
      setTaxRate(18);
    }
  }, [opened, quote]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? quotesApi.update(quote._id, payload) : quotesApi.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      notifications.show({ message: isEdit ? 'Quote updated' : 'Quote created', color: 'teal' });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({
      contact,
      company,
      status,
      validUntil,
      notes,
      items: items.filter((i) => i.description?.trim()),
      taxRate,
    });
  }

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? `Edit ${quote.quoteNumber}` : 'New quote'} size={620}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Group grow>
            <Select label="Contact" data={contactOptions} searchable clearable value={contact} onChange={setContact} />
            <Select label="Company" data={companyOptions} searchable clearable value={company} onChange={setCompany} />
          </Group>
          <Group grow>
            <Select label="Status" data={STATUS_OPTIONS} allowDeselect={false} value={status} onChange={setStatus} />
            <DateInput label="Valid until" clearable value={validUntil} onChange={setValidUntil} />
          </Group>

          <LineItemsEditor
            items={items}
            onChange={setItems}
            taxRate={taxRate}
            onTaxRateChange={setTaxRate}
            interState={(() => {
              const buyerState = (companiesData?.items || []).find((c) => c._id === company)?.stateCode;
              return Boolean(sellerState && buyerState && sellerState !== buyerState);
            })()}
          />

          <Textarea label="Notes" minRows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create quote'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
