import { Stack, Group, NumberInput, Select, TextInput, Textarea, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { PAYMENT_MODE_OPTIONS } from '../../api/adminApi.js';

export const EMPTY_SETTLEMENT = { amount: 0, paymentMode: 'bank_transfer', reference: '', paidAt: new Date(), periodEnd: null, notes: '' };

const MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

// Fields for recording a plan payment. `form` is a Mantine form; `prefix` is the path of the settlement values.
export function SettlementFields({ form, prefix = '', plan }) {
  const p = (name) => (prefix ? `${prefix}.${name}` : name);
  const lifetime = plan?.billingCycle === 'one_time' || plan?.billingCycle === 'free';
  const values = prefix ? form.values[prefix] : form.values;
  const autoEnd = !lifetime && MONTHS[plan?.billingCycle] && values?.paidAt
    ? dayjs(values.paidAt).add(MONTHS[plan.billingCycle], 'month').format('DD MMM YYYY')
    : null;

  return (
    <Stack gap="sm">
      <Group grow>
        <NumberInput label="Amount received (₹)" min={0} thousandSeparator="," {...form.getInputProps(p('amount'))} />
        <Select label="Payment mode" data={PAYMENT_MODE_OPTIONS} allowDeselect={false} {...form.getInputProps(p('paymentMode'))} />
      </Group>
      <Group grow>
        <DateInput label="Paid on" valueFormat="DD MMM YYYY" {...form.getInputProps(p('paidAt'))} />
        <TextInput label="Reference / UTR" placeholder="Txn ID, cheque no." {...form.getInputProps(p('reference'))} />
      </Group>
      <DateInput
        label="Valid until"
        valueFormat="DD MMM YYYY"
        clearable
        placeholder={lifetime ? 'Lifetime — never expires' : `Auto: ${autoEnd || 'one billing cycle'}`}
        description={lifetime ? 'One-time settlement: leave empty for lifetime access' : 'Leave empty to add one billing cycle (renewals extend the current period)'}
        {...form.getInputProps(p('periodEnd'))}
      />
      <Textarea label="Notes" autosize minRows={1} {...form.getInputProps(p('notes'))} />
      {plan && (
        <Text size="xs" c="dimmed">
          Plan price: {plan.priceLabel}. Recording this marks the organization active on {plan.name}.
        </Text>
      )}
    </Stack>
  );
}

// Dates go over the wire as ISO strings; an empty end date means "work it out from the plan".
export function settlementPayload(values) {
  return {
    ...values,
    paidAt: values.paidAt ? dayjs(values.paidAt).toISOString() : undefined,
    periodEnd: values.periodEnd ? dayjs(values.periodEnd).endOf('day').toISOString() : undefined,
  };
}
