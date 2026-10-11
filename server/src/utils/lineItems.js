const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Computes GST-aware totals.
//  - Each item may carry its own GST rate (`taxRate`); otherwise the document-level rate applies.
//  - supplyType 'intra' (same state): tax splits equally into CGST + SGST.
//  - supplyType 'inter' (different state / export): the full amount is IGST.
export function computeTotals(items = [], taxRate = 0, { supplyType = 'intra' } = {}) {
  const defaultRate = Number(taxRate) || 0;
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const rate = item.taxRate === undefined || item.taxRate === null || item.taxRate === '' ? defaultRate : Number(item.taxRate) || 0;
    const total = round2(quantity * unitPrice);
    return {
      product: item.product || undefined,
      description: item.description,
      hsn: item.hsn ? String(item.hsn).trim() : undefined,
      quantity,
      unitPrice,
      taxRate: rate,
      taxAmount: round2((total * rate) / 100),
      total,
    };
  });

  const subtotal = round2(normalizedItems.reduce((sum, i) => sum + i.total, 0));
  const taxAmount = round2(normalizedItems.reduce((sum, i) => sum + i.taxAmount, 0));
  const inter = supplyType === 'inter';
  const cgst = inter ? 0 : round2(taxAmount / 2);
  const sgst = inter ? 0 : round2(taxAmount - cgst);
  const igst = inter ? taxAmount : 0;

  return { items: normalizedItems, subtotal, taxAmount, cgst, sgst, igst, supplyType: inter ? 'inter' : 'intra', total: round2(subtotal + taxAmount) };
}
