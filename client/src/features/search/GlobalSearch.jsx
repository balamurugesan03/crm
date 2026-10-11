import { useState } from 'react';
import { Modal, TextInput, Stack, Text, UnstyledButton, Group, Loader, Kbd, Badge, Alert, ThemeIcon } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconSearch, IconUser, IconBuilding, IconTargetArrow, IconStack2, IconHeadset, IconSparkles, IconChecklist, IconCornerDownLeft,
} from '@tabler/icons-react';
import dayjs from 'dayjs';

import { searchApi } from '../../api/searchApi.js';
import { aiApi } from '../../api/aiApi.js';
import { useAiStatus, aiErrorMessage } from '../ai/useAiStatus.js';

const SECTIONS = [
  { key: 'contacts', label: 'Contacts', icon: IconUser, render: (r) => `${r.firstName} ${r.lastName || ''}`.trim(), to: (r) => `/contacts/${r._id}` },
  { key: 'companies', label: 'Companies', icon: IconBuilding, render: (r) => r.name, to: (r) => `/companies/${r._id}` },
  { key: 'leads', label: 'Leads', icon: IconTargetArrow, render: (r) => r.name, to: () => '/leads' },
  { key: 'deals', label: 'Deals', icon: IconStack2, render: (r) => r.title, to: () => '/deals' },
  { key: 'tickets', label: 'Tickets', icon: IconHeadset, render: (r) => `${r.ticketNumber} — ${r.subject}`, to: () => '/tickets' },
];

const AI_ICON = { deal: IconStack2, lead: IconTargetArrow, contact: IconUser, company: IconBuilding, task: IconChecklist, ticket: IconHeadset };
const inrCompact = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

// Filter chips describing how the AI interpreted the request.
function interpretedChips(q) {
  const chips = [q.entity];
  if (q.status) chips.push(`status: ${q.status}`);
  if (q.stageName) chips.push(`stage: ${q.stageName}`);
  if (q.source) chips.push(`source: ${q.source}`);
  if (q.priority) chips.push(`priority: ${q.priority}`);
  if (q.minAmount != null) chips.push(`≥ ${inrCompact(q.minAmount)}`);
  if (q.maxAmount != null) chips.push(`≤ ${inrCompact(q.maxAmount)}`);
  if (q.minScore != null) chips.push(`score ≥ ${q.minScore}`);
  if (q.dateFrom || q.dateTo) chips.push(`${q.dateField || 'date'}: ${q.dateFrom || '…'} → ${q.dateTo || '…'}`);
  if (q.overdueOnly) chips.push('overdue');
  if (q.ownerName) chips.push(`owner: ${q.ownerName}`);
  if (q.companyName) chips.push(`company: ${q.companyName}`);
  if (q.location) chips.push(`location: ${q.location}`);
  if (q.text) chips.push(`“${q.text}”`);
  return chips;
}

export function GlobalSearch({ opened, onClose }) {
  const navigate = useNavigate();
  const { configured } = useAiStatus();
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 250);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchApi.search(debounced),
    enabled: opened && debounced.trim().length >= 2,
  });

  const ai = useMutation({ mutationFn: aiApi.search });

  const hasResults = data && SECTIONS.some((s) => data[s.key]?.length > 0);
  const canAskAi = configured && query.trim().length >= 3;
  const aiFresh = ai.data && ai.variables === query.trim();

  function close() {
    setQuery('');
    ai.reset();
    onClose();
  }

  function handleSelect(to) {
    navigate(to);
    close();
  }

  function askAi() {
    if (canAskAi) ai.mutate(query.trim());
  }

  return (
    <Modal opened={opened} onClose={close} withCloseButton={false} size="lg" padding={0} radius="md" centered>
      <TextInput
        placeholder={configured ? 'Search, or ask: “deals above 5L closing this month”' : 'Search contacts, companies, leads, deals, tickets...'}
        leftSection={<IconSearch size={18} />}
        rightSection={isFetching || ai.isPending ? <Loader size={14} /> : <Kbd size="xs">Esc</Kbd>}
        rightSectionWidth={50}
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          if (ai.data || ai.error) ai.reset();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') askAi();
        }}
        autoFocus
        size="lg"
        variant="unstyled"
        p="md"
        styles={{ input: { fontSize: 16 } }}
      />

      <Stack gap={0} p="xs" mah={460} style={{ overflowY: 'auto', borderTop: '1px solid var(--app-border)' }}>
        {canAskAi && !aiFresh && (
          <UnstyledButton p="sm" onClick={askAi} style={{ borderRadius: 8, background: 'var(--app-highlight)' }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={26} radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'grape', deg: 135 }}><IconSparkles size={14} /></ThemeIcon>
                <Text size="sm" truncate>Ask AI: <b>{query.trim()}</b></Text>
              </Group>
              <Group gap={4} wrap="nowrap"><Kbd size="xs">Enter</Kbd><IconCornerDownLeft size={14} /></Group>
            </Group>
          </UnstyledButton>
        )}

        {ai.isError && <Alert color="red" variant="light" m="xs">{aiErrorMessage(ai.error)}</Alert>}

        {aiFresh && (
          <div>
            <Group gap={6} px="sm" pt="sm" pb={4}>
              <IconSparkles size={14} color="var(--mantine-color-grape-6)" />
              <Text size="xs" fw={700} c="grape" tt="uppercase">AI results · {ai.data.results.length}</Text>
            </Group>
            <Text size="xs" c="dimmed" px="sm">{ai.data.query.explanation}</Text>
            <Group gap={4} px="sm" py={6}>
              {interpretedChips(ai.data.query).map((c) => <Badge key={c} size="xs" variant="light" color="grape">{c}</Badge>)}
            </Group>
            {ai.data.results.length === 0 && <Text c="dimmed" size="sm" ta="center" py="md">Nothing matched those filters.</Text>}
            {ai.data.results.map((r) => {
              const Icon = AI_ICON[r.type] || IconSearch;
              return (
                <UnstyledButton key={r._id} p="sm" w="100%" onClick={() => handleSelect(r.link)} style={{ borderRadius: 6 }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Icon size={16} color="var(--mantine-color-dimmed)" />
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{r.title}</Text>
                        {r.meta && <Text size="xs" c="dimmed" truncate>{r.meta}</Text>}
                      </div>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      {typeof r.score === 'number' && <Badge size="xs" variant="light" color="orange">{r.score}</Badge>}
                      {typeof r.amount === 'number' && r.amount > 0 && <Text size="xs" fw={600}>{inrCompact(r.amount)}</Text>}
                      {r.date && <Text size="xs" c="dimmed">{dayjs(r.date).format('D MMM')}</Text>}
                    </Group>
                  </Group>
                </UnstyledButton>
              );
            })}
          </div>
        )}

        {query.trim().length < 2 && (
          <Text c="dimmed" size="sm" ta="center" py="lg">Type at least 2 characters to search</Text>
        )}
        {!aiFresh && query.trim().length >= 2 && !isFetching && !hasResults && (
          <Text c="dimmed" size="sm" ta="center" py="lg">No exact matches for "{query}"{canAskAi ? ' — press Enter to ask AI' : ''}</Text>
        )}
        {!aiFresh && data && SECTIONS.map((section) => {
          const items = data[section.key] || [];
          if (items.length === 0) return null;
          return (
            <div key={section.key}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" pt="sm" pb={4}>{section.label}</Text>
              {items.map((item) => (
                <UnstyledButton key={item._id} p="sm" w="100%" onClick={() => handleSelect(section.to(item))} style={{ borderRadius: 6 }}>
                  <Group gap={8}>
                    <section.icon size={16} color="var(--mantine-color-dimmed)" />
                    <Text size="sm">{section.render(item)}</Text>
                  </Group>
                </UnstyledButton>
              ))}
            </div>
          );
        })}
      </Stack>
    </Modal>
  );
}
