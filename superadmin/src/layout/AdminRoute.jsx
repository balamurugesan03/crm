import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export function AdminRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status !== 'authenticated' || !user?.isSuperAdmin) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

// The login page is only for signed-out visitors.
export function AdminPublicOnlyRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return children;
}
