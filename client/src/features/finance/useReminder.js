import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { financeApi } from './financeApi.js';

// Sends a payment reminder. WhatsApp without the Business API opens wa.me with the message pre-filled.
export function useReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, channel }) => financeApi.remind(id, channel),
    onSuccess: (res, { channel }) => {
      if (res.waUrl) window.open(res.waUrl, '_blank', 'noopener');
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notifications.show({
        message: res.waUrl ? 'Reminder opened in WhatsApp and logged' : `Reminder sent by ${channel === 'email' ? 'email' : 'WhatsApp'}`,
        color: 'teal',
      });
    },
    onError: (err) => notifications.show({ message: err?.response?.data?.message || 'Could not send reminder', color: 'red' }),
  });
}
