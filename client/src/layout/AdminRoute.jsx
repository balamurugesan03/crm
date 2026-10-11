import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export function AdminRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  if (!user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
