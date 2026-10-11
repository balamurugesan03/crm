import { Stack, Group, TextInput, NumberInput, ActionIcon, Button, Text, Select, Divider, Badge, Paper, Tooltip } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/productsApi.js';
import { formatCurrency } from '../theme/theme.js';

export const GST_RATES = ['0', '5', '12', '18', '28'];

const money = (n) => formatCurrency(n);
const lineTotal = (item) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
const lineRate = (item, taxRate) => (item.taxRate === undefined || item.taxRate === null || item.taxRate === '' ? Number(taxRate) || 0 : Number(item.taxRate) || 0);

// `interState`: true when seller and buyer are in different states (IGST), false for CGST + SGST.
export function LineItemsEditor({ items, onChange, taxRate, onTaxRateChange, interState = false }) {
  const { data: productsData } = useQuery({
    queryKey: ['products', { forSelect: true }],
    queryFn: () => productsApi.list({ limit: 100, activeOnly: 'true' }),
  });
  const productOptions = (productsData?.items || []).map((p) => ({ value: p._id, label: `${p.name} — ${money(p.price)}` }));
  const productsById = Object.fromEntries((productsData?.items || []).map((p) => [p._id, p]));

  function updateItem(index, patch) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handleProductSelect(index, productId) {
    const product = productsById[productId];
    if (!product) return;
    updateItem(index, {
      product: productId,
      description: product.name,
      unitPrice: product.price,
      hsn: product.hsn || '',
      taxRate: product.gstRate ?? taxRate,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const taxAmount = items.reduce((sum, item) => sum + (lineTotal(item) * lineRate(item, taxRate)) / 100, 0);
  const total = subtotal + taxAmount;

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" fw={500}>Line items</Text>
        <Badge variant="light" color={interState ? 'grape' : 'teal'}>
          {interState ? 'Inter-state supply · IGST' : 'Intra-state supply · CGST + SGST'}
        </Badge>
      </Group>

      {items.map((item, index) => (
        <Paper key={index} p="xs" withBorder bg="var(--app-subtle)">
          <Group align="flex-end" wrap="nowrap" gap="xs" mb={6}>
            <Select
              placeholder="Pick from catalog"
              data={productOptions}
              searchable
              clearable
              w={190}
              size="xs"
              value={item.product || null}
              onChange={(v) => handleProductSelect(index, v)}
            />
            <TextInput
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.currentTarget.value })}
              style={{ flex: 1 }}
              size="xs"
            />
            <ActionIcon color="red" variant="subtle" onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label="Remove line">
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
          <Group wrap="nowrap" gap="xs" align="center">
            <Tooltip label="HSN / SAC code">
              <TextInput placeholder="HSN/SAC" value={item.hsn || ''} onChange={(e) => updateItem(index, { hsn: e.currentTarget.value })} w={90} size="xs" />
            </Tooltip>
            <NumberInput placeholder="Qty" value={item.quantity} onChange={(v) => updateItem(index, { quantity: v })} min={0} w={70} size="xs" />
            <NumberInput placeholder="Rate" value={item.unitPrice} onChange={(v) => updateItem(index, { unitPrice: v })} min={0} prefix="₹" thousandSeparator="," w={110} size="xs" />
            <Select
              data={GST_RATES.map((r) => ({ value: r, label: `${r}% GST` }))}
              value={String(lineRate(item, taxRate))}
              onChange={(v) => updateItem(index, { taxRate: Number(v) })}
              allowDeselect={false}
              w={100}
              size="xs"
            />
            <Text size="xs" fw={600} ta="right" style={{ flex: 1 }}>{money(lineTotal(item))}</Text>
          </Group>
        </Paper>
      ))}

      <Button
        variant="light"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...items, { description: '', hsn: '', quantity: 1, unitPrice: 0, taxRate: Number(taxRate) || 18 }])}
        w="fit-content"
      >
        Add line item
      </Button>

      <Divider my={4} />

      <Group justify="space-between" align="flex-start">
        <Select
          label="Default GST rate"
          description="Used for new lines"
          data={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
          value={String(Number(taxRate) || 0)}
          onChange={(v) => onTaxRateChange(Number(v))}
          allowDeselect={false}
          w={140}
          size="xs"
        />
        <Stack gap={2} align="flex-end">
          <Text size="xs" c="dimmed">Taxable value: {money(subtotal)}</Text>
          {interState ? (
            <Text size="xs" c="dimmed">IGST: {money(taxAmount)}</Text>
          ) : (
            <>
              <Text size="xs" c="dimmed">CGST: {money(taxAmount / 2)}</Text>
              <Text size="xs" c="dimmed">SGST: {money(taxAmount / 2)}</Text>
            </>
          )}
          <Text size="sm" fw={700}>Total: {money(total)}</Text>
        </Stack>
      </Group>
    </Stack>
  );
}
