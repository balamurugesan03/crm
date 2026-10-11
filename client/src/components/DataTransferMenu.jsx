import { useState } from 'react';
import { Menu, Button, Modal, Stack, Text, Group, Alert, List, FileButton, Paper, ThemeIcon, SimpleGrid } from '@mantine/core';
import {
  IconDatabaseExport, IconDownload, IconUpload, IconFileSpreadsheet, IconChevronDown, IconCheck, IconAlertTriangle,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { dataTransferApi } from '../api/dataTransferApi.js';

// `entity` is the API collection name (contacts, companies, leads, deals, tickets).
// Import is only offered where the server supports it.
export function DataTransferMenu({ entity, label, canImport = true }) {
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const importMutation = useMutation({
    mutationFn: async (f) => dataTransferApi.importCsv(entity, await f.text()),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: [entity] });
      if (entity === 'contacts') queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Import failed', color: 'red' }),
  });

  async function handleExport() {
    try {
      await dataTransferApi.exportCsv(entity);
      notifications.show({ message: `${label} exported`, color: 'teal' });
    } catch {
      notifications.show({ message: 'Export failed', color: 'red' });
    }
  }

  function closeImport() {
    setImportOpen(false);
    setFile(null);
    setResult(null);
  }

  return (
    <>
      <Menu position="bottom-end" width={200}>
        <Menu.Target>
          <Button variant="default" leftSection={<IconDatabaseExport size={16} />} rightSection={<IconChevronDown size={14} />}>
            Data
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconDownload size={15} />} onClick={handleExport}>Export to CSV</Menu.Item>
          {canImport && (
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setImportOpen(true)}>Import from CSV</Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal opened={importOpen} onClose={closeImport} title={<Text fw={700}>Import {label.toLowerCase()}</Text>} size="lg" centered>
        {result ? (
          <Stack>
            <SimpleGrid cols={3}>
              <Paper p="md" ta="center"><Text fz={26} fw={700} c="teal">{result.imported}</Text><Text size="xs" c="dimmed">Imported</Text></Paper>
              <Paper p="md" ta="center"><Text fz={26} fw={700} c="gray">{result.skipped}</Text><Text size="xs" c="dimmed">Duplicates skipped</Text></Paper>
              <Paper p="md" ta="center"><Text fz={26} fw={700} c={result.failed ? 'red' : 'gray'}>{result.failed}</Text><Text size="xs" c="dimmed">Failed</Text></Paper>
            </SimpleGrid>
            {result.errors?.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Some rows were not imported">
                <List size="xs">
                  {result.errors.slice(0, 8).map((e) => <List.Item key={e.row}>Row {e.row}: {e.message}</List.Item>)}
                </List>
              </Alert>
            )}
            <Group justify="flex-end"><Button onClick={closeImport} leftSection={<IconCheck size={16} />}>Done</Button></Group>
          </Stack>
        ) : (
          <Stack>
            <Text size="sm" c="dimmed">
              Upload a CSV with a header row. Column names are matched flexibly (e.g. “First Name”, “first_name”, “E-mail”).
              Duplicates are skipped automatically.
            </Text>
            <Group>
              <Button variant="subtle" size="xs" leftSection={<IconDownload size={14} />} onClick={() => dataTransferApi.downloadTemplate(entity)}>
                Download template
              </Button>
            </Group>
            <FileButton onChange={setFile} accept=".csv,text/csv">
              {(props) => (
                <Paper
                  {...props}
                  p="xl"
                  withBorder
                  style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}
                >
                  <ThemeIcon size={44} radius="xl" variant="light" mx="auto" mb="xs"><IconFileSpreadsheet size={22} /></ThemeIcon>
                  <Text fw={600} size="sm">{file ? file.name : 'Choose a CSV file'}</Text>
                  <Text size="xs" c="dimmed">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Max 5,000 rows'}</Text>
                </Paper>
              )}
            </FileButton>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeImport}>Cancel</Button>
              <Button disabled={!file} loading={importMutation.isPending} onClick={() => importMutation.mutate(file)} leftSection={<IconUpload size={16} />}>
                Import
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
