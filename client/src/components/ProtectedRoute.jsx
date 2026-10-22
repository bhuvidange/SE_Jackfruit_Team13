import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a page that needs a signed-in user. Pass `roles` to also restrict by role
 * (CSMQP-F-003); the server enforces the same rules, this only hides pages.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card" role="alert">
        <h1>Access denied</h1>
        <p>Your role ({user.role}) cannot open this page.</p>
      </div>
    );
  }
  return children;
}
