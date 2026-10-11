import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Group, Stack, Text, Table, Button, Badge, Center, Loader, Divider, SimpleGrid, Image } from '@mantine/core';
import { IconPrinter, IconArrowLeft, IconStack3 } from '@tabler/icons-react';
import QRCode from 'qrcode';
import dayjs from 'dayjs';

import { quotesApi } from '../../api/quotesApi.js';
import { invoicesApi } from '../../api/invoicesApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { stateName } from '../../utils/gstStates.js';
import { amountInWords } from '../../utils/numberToWords.js';

const CONFIG = {
  quote: { api: quotesApi, title: 'QUOTATION', numberKey: 'quoteNumber', back: '/quotes' },
  invoice: { api: invoicesApi, title: 'TAX INVOICE', numberKey: 'invoiceNumber', back: '/invoices' },
};

const INK = '#1a1d29';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const BRAND = '#4f4ff0';

const money = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function Label({ children }) {
  return <Text size="10px" fw={700} c={MUTED} tt="uppercase" style={{ letterSpacing: '0.06em' }}>{children}</Text>;
}

function KV({ k, v }) {
  if (!v) return null;
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="xs" c={MUTED} w={92}>{k}</Text>
      <Text size="xs" fw={600} c={INK}>{v}</Text>
    </Group>
  );
}

// Generates the UPI deep-link QR for an unpaid invoice.
export function useUpiQr(type, doc, seller) {
  const [upiQr, setUpiQr] = useState(null);
  const bp = seller?.billingProfile || {};
  const due = doc ? Math.max(0, Math.round(((doc.total || 0) - (doc.amountPaid || 0)) * 100) / 100) : 0;
  const show = type === 'invoice' && doc && due > 0 && !['paid', 'void', 'draft'].includes(doc.status) && bp.upiId;
  const number = doc?.invoiceNumber;
  useEffect(() => {
    if (!show) return;
    const uri = `upi://pay?pa=${encodeURIComponent(bp.upiId)}&pn=${encodeURIComponent(bp.legalName || seller.name)}&am=${due.toFixed(2)}&cu=INR&tn=${encodeURIComponent(number)}`;
    QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setUpiQr).catch(() => setUpiQr(null));
  }, [show, bp.upiId, bp.legalName, seller?.name, due, number]);
  return { upiQr, waiting: Boolean(show && !upiQr), due };
}

// Print-optimised A4 GST document. "Save as PDF" in the browser print dialog produces the PDF.
export function PrintDocumentPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const organization = useAuthStore((s) => s.organization);
  const cfg = CONFIG[type];
  const { data: doc, isLoading } = useQuery({
    queryKey: [`${type}s`, id, 'print'],
    queryFn: () => cfg.api.get(id),
    enabled: Boolean(cfg),
  });

  const seller = { name: organization?.name, billingProfile: organization?.billingProfile || {} };
  const { upiQr, waiting } = useUpiQr(type, doc, seller);

  useEffect(() => {
    if (!doc) return undefined;
    document.title = `${doc[cfg.numberKey]} — ${seller.billingProfile.legalName || seller.name || 'NexusCRM'}`;
    // Wait for the QR (if any) to render before opening the print dialog.
    if (waiting) return undefined;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [doc, cfg, seller.name, seller.billingProfile.legalName, waiting]);

  if (!cfg) return <Center h="100vh"><Text>Unknown document type</Text></Center>;
  if (isLoading || !doc) return <Center h="100vh"><Loader /></Center>;

  return (
    <Box bg="#eef0f5" mih="100vh" py={32} px={16} style={{ colorScheme: 'light' }}>
      <Group justify="center" mb="md" className="no-print" gap="sm">
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(cfg.back)}>Back</Button>
        <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </Group>
      <DocumentSheet type={type} doc={doc} seller={seller} upiQr={upiQr} />
    </Box>
  );
}

// Presentational A4 sheet shared by the in-app print view and the customer portal.
export function DocumentSheet({ type, doc, seller, upiQr }) {
  const cfg = CONFIG[type];
  const bp = seller?.billingProfile || {};
  const sellerName = bp.legalName || seller?.name;

  const inter = doc.supplyType === 'inter';
  const buyerName = doc.company?.name || (doc.contact ? `${doc.contact.firstName} ${doc.contact.lastName || ''}` : '—');
  const buyerGstin = doc.customerGstin || doc.company?.gstin;
  const pos = doc.placeOfSupply || doc.company?.stateCode;
  const hasHsn = doc.items.some((i) => i.hsn);

  return (
      <Box className="print-sheet" maw={860} mx="auto" p={44} bg="white" c={INK} style={{ borderRadius: 12, boxShadow: '0 20px 50px -20px rgba(16,24,40,.25)' }}>
        {/* Header */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap={12} align="flex-start" wrap="nowrap">
            <Box w={44} h={44} style={{ borderRadius: 10, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#5f62f5,#8b5cf6)', flexShrink: 0 }}>
              <IconStack3 size={24} color="white" />
            </Box>
            <div>
              <Text fw={800} fz={19} c={INK}>{sellerName}</Text>
              {bp.address && <Text size="xs" c={MUTED} maw={360}>{[bp.address, bp.city, bp.pincode].filter(Boolean).join(', ')}</Text>}
              <Text size="xs" c={MUTED}>{[bp.phone, bp.email].filter(Boolean).join(' · ')}</Text>
              <Group gap="md" mt={4}>
                {bp.gstin && <Text size="xs" fw={700} c={INK}>GSTIN: {bp.gstin}</Text>}
                {bp.pan && <Text size="xs" c={MUTED}>PAN: {bp.pan}</Text>}
                {bp.stateCode && <Text size="xs" c={MUTED}>State: {stateName(bp.stateCode)} ({bp.stateCode})</Text>}
              </Group>
            </div>
          </Group>
          <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
            <Text fw={800} fz={22} c={BRAND} style={{ letterSpacing: '0.06em' }}>{cfg.title}</Text>
            <Text fw={700} c={INK}># {doc[cfg.numberKey]}</Text>
            <Badge variant="light" color={doc.status === 'paid' || doc.status === 'accepted' ? 'teal' : doc.status === 'overdue' ? 'red' : doc.status === 'partially_paid' ? 'yellow' : 'gray'}>{doc.status.replace('_', ' ')}</Badge>
            {type === 'invoice' && <Text size="10px" c={MUTED}>Original for recipient</Text>}
          </Stack>
        </Group>

        <Divider my="lg" color={LINE} />

        {/* Parties */}
        <SimpleGrid cols={2} spacing="xl">
          <div>
            <Label>Bill to</Label>
            <Text fw={700} mt={4} c={INK}>{buyerName}</Text>
            {doc.contact && doc.company && <Text size="xs" c={MUTED}>Attn: {doc.contact.firstName} {doc.contact.lastName}</Text>}
            {doc.company?.address && <Text size="xs" c={MUTED}>{doc.company.address}</Text>}
            {doc.contact?.email && <Text size="xs" c={MUTED}>{doc.contact.email}</Text>}
            {(doc.contact?.phone || doc.company?.phone) && <Text size="xs" c={MUTED}>{doc.contact?.phone || doc.company?.phone}</Text>}
            <Stack gap={2} mt={6}>
              <KV k="GSTIN" v={buyerGstin || 'Unregistered'} />
              <KV k="Place of supply" v={pos ? `${stateName(pos)} (${pos})` : null} />
            </Stack>
          </div>
          <Stack gap={4} align="flex-end">
            <KV k="Date" v={dayjs(doc.issueDate || doc.createdAt).format('DD MMM YYYY')} />
            <KV k="Due date" v={doc.dueDate && dayjs(doc.dueDate).format('DD MMM YYYY')} />
            <KV k="Valid until" v={doc.validUntil && dayjs(doc.validUntil).format('DD MMM YYYY')} />
            <KV k="Supply type" v={inter ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'} />
            <KV k="Prepared by" v={doc.ownerUser?.name} />
          </Stack>
        </SimpleGrid>

        {/* Items */}
        <Table mt={28} verticalSpacing={8} horizontalSpacing={8} withRowBorders style={{ color: INK, fontSize: 12.5 }}>
          <Table.Thead style={{ background: '#f4f5fb' }}>
            <Table.Tr>
              {['#', 'Description', hasHsn && 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount'].filter(Boolean).map((h, i) => (
                <Table.Th key={h} style={{ color: '#4b5563', fontSize: 11, textAlign: i > 1 && h !== 'HSN/SAC' ? 'right' : 'left' }}>{h}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {doc.items.map((item, i) => {
              const rate = item.taxRate ?? doc.taxRate ?? 0;
              const tax = item.taxAmount ?? (item.total * rate) / 100;
              return (
                <Table.Tr key={i}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td fw={500}>{item.description}</Table.Td>
                  {hasHsn && <Table.Td>{item.hsn || '—'}</Table.Td>}
                  <Table.Td ta="right">{item.quantity}</Table.Td>
                  <Table.Td ta="right">{money(item.unitPrice)}</Table.Td>
                  <Table.Td ta="right">{money(item.total)}</Table.Td>
                  <Table.Td ta="right">{rate}%</Table.Td>
                  <Table.Td ta="right" fw={600}>{money(item.total + tax)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {/* Totals */}
        <Group justify="space-between" align="flex-start" mt="lg" wrap="nowrap">
          <Stack gap={4} maw={420}>
            <Label>Amount in words</Label>
            <Text size="sm" fw={600} c={INK}>{amountInWords(doc.total)}</Text>
          </Stack>
          <Stack gap={6} w={300}>
            <Group justify="space-between"><Text size="sm" c={MUTED}>Taxable value</Text><Text size="sm">₹{money(doc.subtotal)}</Text></Group>
            {inter ? (
              <Group justify="space-between"><Text size="sm" c={MUTED}>IGST</Text><Text size="sm">₹{money(doc.igst ?? doc.taxAmount)}</Text></Group>
            ) : (
              <>
                <Group justify="space-between"><Text size="sm" c={MUTED}>CGST</Text><Text size="sm">₹{money(doc.cgst ?? doc.taxAmount / 2)}</Text></Group>
                <Group justify="space-between"><Text size="sm" c={MUTED}>SGST</Text><Text size="sm">₹{money(doc.sgst ?? doc.taxAmount / 2)}</Text></Group>
              </>
            )}
            <Divider color={LINE} />
            <Group justify="space-between"><Text fw={800} c={INK}>Total</Text><Text fw={800} fz={18} c={BRAND}>₹{money(doc.total)}</Text></Group>
            {type === 'invoice' && doc.amountPaid > 0 && doc.status !== 'paid' && (
              <>
                <Group justify="space-between"><Text size="sm" c={MUTED}>Amount received</Text><Text size="sm" c="teal">− ₹{money(doc.amountPaid)}</Text></Group>
                <Group justify="space-between"><Text fw={800} c={INK}>Balance due</Text><Text fw={800} c="red">₹{money(doc.total - doc.amountPaid)}</Text></Group>
              </>
            )}
            {doc.status === 'paid' && <Badge color="teal" variant="light" ml="auto">Paid{doc.paidAt ? ` on ${dayjs(doc.paidAt).format('DD MMM YYYY')}` : ''}</Badge>}
          </Stack>
        </Group>

        {/* Payment */}
        {type === 'invoice' && (bp.bankAccount || upiQr) && (
          <Group mt={28} p="md" justify="space-between" align="center" wrap="nowrap" style={{ background: '#f8f9fc', borderRadius: 10 }}>
            <Stack gap={3}>
              <Label>Pay to</Label>
              <KV k="Account name" v={sellerName} />
              <KV k="Bank" v={bp.bankName} />
              <KV k="Account no." v={bp.bankAccount} />
              <KV k="IFSC" v={bp.ifsc} />
              <KV k="UPI ID" v={bp.upiId} />
            </Stack>
            {upiQr && (
              <Stack gap={2} align="center">
                <Image src={upiQr} w={112} h={112} alt="UPI payment QR" />
                <Text size="10px" fw={700} c={INK}>Scan to pay ₹{money(Math.max(0, doc.total - (doc.amountPaid || 0)))}</Text>
                <Text size="9px" c={MUTED}>GPay · PhonePe · Paytm · BHIM</Text>
              </Stack>
            )}
          </Group>
        )}

        {(doc.notes || bp.invoiceTerms) && (
          <Box mt="lg">
            <Label>{doc.notes ? 'Notes' : 'Terms & conditions'}</Label>
            <Text size="xs" c={MUTED} mt={4} style={{ whiteSpace: 'pre-wrap' }}>{doc.notes}</Text>
            {doc.notes && bp.invoiceTerms && <Text size="xs" c={MUTED} mt={6}>{bp.invoiceTerms}</Text>}
            {!doc.notes && <Text size="xs" c={MUTED} mt={4}>{bp.invoiceTerms}</Text>}
          </Box>
        )}

        <Group justify="space-between" align="flex-end" mt={44}>
          <Text size="10px" c="#9ca3af" maw={380}>
            This is a computer-generated {type === 'invoice' ? 'invoice' : 'quotation'}. {inter ? 'IGST' : 'CGST & SGST'} charged as applicable under the GST Act.
          </Text>
          <Stack gap={28} align="flex-end">
            <Text size="xs" fw={600} c={INK}>For {sellerName}</Text>
            <Text size="xs" c={MUTED}>Authorised Signatory</Text>
          </Stack>
        </Group>
      </Box>
  );
}
