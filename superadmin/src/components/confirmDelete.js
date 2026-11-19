import { modals } from '@mantine/modals';

export function confirmDelete({ title = 'Delete this record?', message, onConfirm, confirmLabel = 'Delete', confirmColor = 'red' }) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: message,
    labels: { confirm: confirmLabel, cancel: 'Cancel' },
    confirmProps: { color: confirmColor },
    onConfirm,
  });
}
