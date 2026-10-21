import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, loading, logout } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="card">
      <h1>Welcome, {user.name}</h1>
      <p>
        You are signed in as <strong>{user.role}</strong> ({user.email}).
      </p>
      <button className="btn secondary" onClick={logout}>Log out</button>
    </div>
  );
}
