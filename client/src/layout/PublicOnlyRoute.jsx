import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export function PublicOnlyRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.organization);

  if (status === 'authenticated') {
    return <Navigate to={user?.isSuperAdmin && !organization ? '/admin' : '/'} replace />;
  }
  return children;
}
