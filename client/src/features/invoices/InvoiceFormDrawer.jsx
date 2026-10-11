import { Stack, Select, Button, Group, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { FormDrawer } from '../../components/FormDrawer.jsx';
import { LineItemsEditor } from '../../components/LineItemsEditor.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { invoicesApi } from '../../api/invoicesApi.js';
import { contactsApi } from '../../api/contactsApi.js';
import { companiesApi } from '../../api/companiesApi.js';

export function InvoiceFormDrawer({ opened, onClose, invoice }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(invoice);

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
  const [dueDate, setDueDate] = useState(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [issueDate, setIssueDate] = useState(new Date());
  // Only draft / sent / void are chosen by hand; part-paid, paid and overdue are derived from payments and due date.
  const [state, setState] = useState('draft');

  useEffect(() => {
    if (!opened) return;
    if (invoice) {
      setContact(invoice.contact?._id || invoice.contact || null);
      setCompany(invoice.company?._id || invoice.company || null);
      setDueDate(invoice.dueDate ? new Date(invoice.dueDate) : null);
      setNotes(invoice.notes || '');
      setItems(invoice.items?.length ? invoice.items : [{ description: '', quantity: 1, unitPrice: 0 }]);
      setTaxRate(invoice.taxRate || 0);
      setIssueDate(invoice.issueDate ? new Date(invoice.issueDate) : new Date());
      setState(invoice.status === 'draft' || invoice.status === 'void' ? invoice.status : 'sent');
    } else {
      setContact(null);
      setCompany(null);
      setDueDate(null);
      setNotes('');
      setItems([{ description: '', hsn: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
      setTaxRate(18);
      setIssueDate(new Date());
      setDueDate(new Date(Date.now() + 15 * 864e5));
      setState('sent');
    }
  }, [opened, invoice]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? invoicesApi.update(invoice._id, payload) : invoicesApi.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      notifications.show({ message: isEdit ? 'Invoice updated' : 'Invoice created', color: 'teal' });
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({
      contact,
      company,
      dueDate,
      issueDate,
      status: state,
      notes,
      items: items.filter((i) => i.description?.trim()),
      taxRate,
    });
  }

  return (
    <FormDrawer opened={opened} onClose={onClose} title={isEdit ? `Edit ${invoice.invoiceNumber}` : 'New invoice'} size={620}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Group grow>
            <Select label="Contact" data={contactOptions} searchable clearable value={contact} onChange={setContact} />
            <Select label="Company" data={companyOptions} searchable clearable value={company} onChange={setCompany} />
          </Group>
          <Group grow>
            <DateInput label="Invoice date" value={issueDate} onChange={setIssueDate} valueFormat="DD MMM YYYY" />
            <DateInput label="Due date" clearable value={dueDate} onChange={setDueDate} valueFormat="DD MMM YYYY" minDate={issueDate || undefined} />
            <Select
              label="Status"
              data={[
                { value: 'draft', label: 'Draft (not sent)' },
                { value: 'sent', label: isEdit && invoice.status !== 'draft' && invoice.status !== 'void' ? 'Issued (status from payments)' : 'Issued / sent' },
                { value: 'void', label: 'Void (cancelled)' },
              ]}
              value={state}
              onChange={(v) => setState(v || 'draft')}
              allowDeselect={false}
              disabled={isEdit && (invoice.amountPaid || 0) > 0}
            />
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
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create invoice'}</Button>
          </Group>
        </Stack>
      </form>
    </FormDrawer>
  );
}
