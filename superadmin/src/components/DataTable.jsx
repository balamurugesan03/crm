import { Table, TextInput, Group, Pagination, Paper, ScrollArea, Skeleton, Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { EmptyState } from './EmptyState.jsx';

export function DataTable({
  columns,
  rows,
  loading,
  search,
  onSearchChange,
  page,
  pages,
  total,
  onPageChange,
  onRowClick,
  toolbar,
  emptyTitle = 'No records yet',
  emptyDescription,
}) {
  return (
    <Paper p={0} shadow="xs" style={{ overflow: 'hidden' }}>
      <Group p="md" pb="sm" justify="space-between" gap="sm">
        <TextInput
          placeholder="Search…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          w={{ base: '100%', xs: 300 }}
        />
        {toolbar && <Group gap="xs">{toolbar}</Group>}
      </Group>

      <ScrollArea>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={680}>
          <Table.Thead style={{ background: 'var(--app-subtle)' }}>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th key={col.key} style={{ whiteSpace: 'nowrap' }}>{col.header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <Table.Tr key={`sk-${i}`}>
                    {columns.map((col) => (
                      <Table.Td key={col.key}><Skeleton h={14} radius="sm" /></Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : rows.map((row) => (
                  <Table.Tr
                    key={row._id}
                    className="data-row"
                    onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {columns.map((col) => (
                      <Table.Td key={col.key}>{col.render ? col.render(row) : row[col.key]}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {!loading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}

      {!loading && (pages > 1 || total) && (
        <Group justify="space-between" p="md" style={{ borderTop: '1px solid var(--app-border)' }}>
          <Text size="xs" c="dimmed">{typeof total === 'number' ? `${total.toLocaleString('en-IN')} records` : ''}</Text>
          {pages > 1 && <Pagination total={pages} value={page} onChange={onPageChange} size="sm" />}
        </Group>
      )}
    </Paper>
  );
}
