import { useState } from 'react';
import { Paper, Table, Group, Select, Badge, Avatar, Text, Pagination, ScrollArea, Skeleton, Code } from '@mantine/core';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { auditLogsApi } from '../../api/auditLogsApi.js';
import { EmptyState } from '../../components/EmptyState.jsx';

const ACTION_COLORS = { create: 'teal', update: 'blue', delete: 'red', import: 'grape', export: 'orange', login: 'gray' };
const RESOURCES = ['contacts', 'companies', 'leads', 'deals', 'tasks', 'events', 'tickets', 'quotes', 'invoices', 'products', 'campaigns', 'automations', 'attachments', 'users', 'organization', 'pipeline-stages'];

export function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null);
  const [resource, setResource] = useState(null);

  const params = { page, limit: 25, action: action || undefined, resource: resource || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditLogsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];

  return (
    <Paper p={0} style={{ overflow: 'hidden' }}>
      <Group p="md" gap="sm">
        <Select
          placeholder="All actions"
          data={Object.keys(ACTION_COLORS)}
          value={action}
          onChange={(v) => { setAction(v); setPage(1); }}
          clearable
          w={160}
        />
        <Select
          placeholder="All resources"
          data={RESOURCES}
          value={resource}
          onChange={(v) => { setResource(v); setPage(1); }}
          clearable
          searchable
          w={190}
        />
        <Text size="xs" c="dimmed" ml="auto">Every create, update, delete, import and export is recorded for 12 months.</Text>
      </Group>
      <ScrollArea>
        <Table verticalSpacing="sm" horizontalSpacing="md" miw={760} highlightOnHover>
          <Table.Thead style={{ background: 'var(--app-subtle)' }}>
            <Table.Tr>
              <Table.Th>When</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Resource</Table.Th>
              <Table.Th>Endpoint</Table.Th>
              <Table.Th>IP</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading
              ? Array.from({ length: 8 }, (_, i) => (
                  <Table.Tr key={i}>{Array.from({ length: 6 }, (__, j) => <Table.Td key={j}><Skeleton h={12} /></Table.Td>)}</Table.Tr>
                ))
              : items.map((log) => (
                  <Table.Tr key={log._id}>
                    <Table.Td><Text size="sm">{dayjs(log.createdAt).format('DD MMM, h:mm:ss A')}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Avatar size={24} radius="xl" color={log.user?.avatarColor}>{log.user?.name?.[0]}</Avatar>
                        <Text size="sm">{log.user?.name || 'Unknown'}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Badge variant="light" color={ACTION_COLORS[log.action]}>{log.action}</Badge></Table.Td>
                    <Table.Td><Text size="sm" tt="capitalize">{log.resource?.replace('-', ' ')}</Text></Table.Td>
                    <Table.Td><Code fz="xs">{log.method} {log.path}</Code></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{log.ip}</Text></Table.Td>
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {!isLoading && items.length === 0 && <EmptyState title="No audit events" description="Changes made by your team will be listed here." />}
      {data?.pages > 1 && (
        <Group justify="flex-end" p="md"><Pagination total={data.pages} value={page} onChange={setPage} size="sm" /></Group>
      )}
    </Paper>
  );
}
