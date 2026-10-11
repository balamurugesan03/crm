import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export function PublicOnlyRoute({ children }) {
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return children;
}
