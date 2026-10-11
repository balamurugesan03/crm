import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../store/authStore.js';
import { API_BASE } from '../utils/paths.js';

// Opens one authenticated socket per session and turns server pushes into cache updates + toasts.
export function useRealtime() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return undefined;
    const socket = io({
      path: `${API_BASE}/socket.io`,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (n) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({ title: n.title, message: n.body || 'You have a new notification', color: 'indigo', autoClose: 5000 });
    });

    return () => {
      socket.disconnect();
    };
    // Reconnect when the user changes; token refreshes are picked up by the auth callback on reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, Boolean(accessToken)]);
}
