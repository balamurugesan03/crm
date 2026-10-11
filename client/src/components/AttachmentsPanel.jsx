import { useState } from 'react';
import { Stack, Group, Text, ActionIcon, Tooltip, Progress, Avatar, ThemeIcon, Paper } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconUpload, IconFile, IconFileTypePdf, IconPhoto, IconFileSpreadsheet, IconDownload, IconTrash, IconEye, IconX,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

import { attachmentsApi } from '../api/attachmentsApi.js';
import { confirmDelete } from './confirmDelete.js';

function fileIcon(mime = '') {
  if (mime.startsWith('image/')) return { icon: IconPhoto, color: 'grape' };
  if (mime === 'application/pdf') return { icon: IconFileTypePdf, color: 'red' };
  if (mime.includes('sheet') || mime.includes('csv') || mime.includes('excel')) return { icon: IconFileSpreadsheet, color: 'teal' };
  return { icon: IconFile, color: 'blue' };
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PREVIEWABLE = (mime = '') => mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/');

export function AttachmentsPanel({ entityType, entityId }) {
  const queryClient = useQueryClient();
  const queryKey = ['attachments', entityType, entityId];
  const [progress, setProgress] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => attachmentsApi.list(entityType, entityId),
    enabled: Boolean(entityId),
  });

  const upload = useMutation({
    mutationFn: (files) =>
      attachmentsApi.upload(entityType, entityId, files, (e) => setProgress(Math.round((e.loaded / (e.total || 1)) * 100))),
    onSuccess: (docs) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [`${entityType.toLowerCase()}s`] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      notifications.show({ message: `${docs.length} file${docs.length > 1 ? 's' : ''} uploaded`, color: 'teal' });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Upload failed', color: 'red' }),
    onSettled: () => setProgress(null),
  });

  const remove = useMutation({
    mutationFn: attachmentsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Stack gap="md">
      <Dropzone
        onDrop={(files) => upload.mutate(files)}
        onReject={(rejections) =>
          notifications.show({ message: rejections[0]?.errors[0]?.message || 'File rejected', color: 'red' })
        }
        maxSize={10 * 1024 * 1024}
        maxFiles={5}
        loading={upload.isPending}
        radius="md"
      >
        <Group justify="center" gap="md" mih={90} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept><IconUpload size={32} color="var(--mantine-color-indigo-6)" /></Dropzone.Accept>
          <Dropzone.Reject><IconX size={32} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
          <Dropzone.Idle><IconUpload size={30} color="var(--mantine-color-dimmed)" /></Dropzone.Idle>
          <div>
            <Text size="sm" fw={600}>Drop files here or click to browse</Text>
            <Text size="xs" c="dimmed">Up to 5 files, 10 MB each — PDFs, images, docs, spreadsheets</Text>
          </div>
        </Group>
      </Dropzone>

      {progress !== null && <Progress value={progress} size="sm" animated />}

      {!isLoading && items.length === 0 && <Text size="sm" c="dimmed" ta="center">No files attached yet.</Text>}

      <Stack gap={6}>
        {items.map((a) => {
          const { icon: Icon, color } = fileIcon(a.mimeType);
          return (
            <Paper key={a._id} p="xs" px="sm" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color={color} size={36} radius="md"><Icon size={18} /></ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate maw={260}>{a.originalName}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">{formatSize(a.size)} · {dayjs(a.createdAt).format('DD MMM YYYY')}</Text>
                      {a.uploadedBy && (
                        <Avatar size={14} radius="xl" color={a.uploadedBy.avatarColor}>{a.uploadedBy.name?.[0]}</Avatar>
                      )}
                    </Group>
                  </div>
                </Group>
                <Group gap={2} wrap="nowrap">
                  {PREVIEWABLE(a.mimeType) && (
                    <Tooltip label="Preview">
                      <ActionIcon variant="subtle" color="gray" onClick={() => attachmentsApi.download(a, { inline: true })}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Download">
                    <ActionIcon variant="subtle" color="gray" onClick={() => attachmentsApi.download(a)}>
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        confirmDelete({ message: `Delete "${a.originalName}"?`, onConfirm: () => remove.mutate(a._id) })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    </Stack>
  );
}
