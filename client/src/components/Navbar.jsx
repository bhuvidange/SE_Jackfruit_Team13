import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const isStaff = user && (user.role === 'instructor' || user.role === 'admin');

  return (
    <nav className="navbar" aria-label="Main">
      <NavLink to="/" className="brand">CSMQP</NavLink>
      {user ? (
        <>
          <NavLink to="/materials">Study Materials</NavLink>
          {isStaff && <NavLink to="/questions">Question Bank</NavLink>}
          {user.role !== 'admin' && <NavLink to="/quizzes">Quizzes</NavLink>}
          <span>{user.name} ({user.role})</span>
          <button type="button" onClick={logout}>Log out</button>
        </>
      ) : (
        <>
          <NavLink to="/login">Log in</NavLink>
          <NavLink to="/register">Register</NavLink>
        </>
      )}
    </nav>
  );
}
