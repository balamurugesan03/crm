import { Stack, TextInput, Textarea, NumberInput, Select, MultiSelect, Checkbox, Divider, Group, Text, Anchor, Badge } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { api } from '../api/axios.js';
import { formatCurrency } from '../theme/theme.js';

export const customFieldsApi = {
  list: (entity) => api.get('/custom-fields', { params: entity ? { entity } : {} }).then((r) => r.data),
  create: (payload) => api.post('/custom-fields', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/custom-fields/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/custom-fields/${id}`).then((r) => r.data),
};

export function useCustomFields(entity) {
  const { data = [] } = useQuery({ queryKey: ['custom-fields', entity], queryFn: () => customFieldsApi.list(entity), staleTime: 60_000 });
  return data;
}

function FieldInput({ def, value, onChange }) {
  const common = { label: def.label, description: def.helpText, required: def.required };
  switch (def.type) {
    case 'textarea':
      return <Textarea {...common} autosize minRows={2} value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
    case 'number':
      return <NumberInput {...common} value={value ?? ''} onChange={onChange} />;
    case 'currency':
      return <NumberInput {...common} value={value ?? ''} onChange={onChange} prefix="₹" thousandSeparator="," min={0} />;
    case 'date':
      return <DateInput {...common} value={value ? new Date(value) : null} onChange={(d) => onChange(d ? d.toISOString() : null)} valueFormat="DD MMM YYYY" clearable />;
    case 'select':
      return <Select {...common} data={def.options} value={value ?? null} onChange={onChange} clearable searchable />;
    case 'multiselect':
      return <MultiSelect {...common} data={def.options} value={Array.isArray(value) ? value : []} onChange={onChange} clearable searchable />;
    case 'checkbox':
      return <Checkbox label={def.label} description={def.helpText} checked={Boolean(value)} onChange={(e) => onChange(e.currentTarget.checked)} mt="xs" />;
    case 'url':
      return <TextInput {...common} type="url" placeholder="https://" value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
    case 'email':
      return <TextInput {...common} type="email" value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
    case 'phone':
      return <TextInput {...common} type="tel" value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
    default:
      return <TextInput {...common} value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
}

// Form section rendering the org's custom fields for a record type.
export function CustomFieldInputs({ entity, value = {}, onChange }) {
  const defs = useCustomFields(entity);
  if (!defs.length) return null;
  return (
    <Stack gap="sm">
      <Divider label="Additional details" labelPosition="left" />
      {defs.map((def) => (
        <FieldInput key={def._id} def={def} value={value?.[def.key]} onChange={(v) => onChange({ ...(value || {}), [def.key]: v })} />
      ))}
    </Stack>
  );
}

export function formatCustomValue(def, v) {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  switch (def.type) {
    case 'date':
      return dayjs(v).format('DD MMM YYYY');
    case 'currency':
      return formatCurrency(v);
    case 'checkbox':
      return v ? 'Yes' : 'No';
    case 'multiselect':
      return v.join(', ');
    default:
      return String(v);
  }
}

// Read-only key/value rows for detail pages.
export function CustomFieldValues({ entity, values = {} }) {
  const defs = useCustomFields(entity);
  return defs.map((def) => {
    const v = values?.[def.key];
    let display = formatCustomValue(def, v);
    if (def.type === 'url' && v) display = <Anchor href={v} target="_blank" rel="noopener noreferrer" size="sm">{v}</Anchor>;
    if (def.type === 'multiselect' && Array.isArray(v) && v.length) display = <Group gap={4}>{v.map((x) => <Badge key={x} size="sm" variant="light">{x}</Badge>)}</Group>;
    return (
      <Group key={def._id} justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="sm">{def.label}</Text>
        {typeof display === 'string' ? <Text size="sm" ta="right">{display}</Text> : display}
      </Group>
    );
  });
}
