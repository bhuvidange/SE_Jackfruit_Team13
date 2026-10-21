import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mirrors the server password policy: 8-64 characters with a lowercase letter, an uppercase letter and a digit.
export function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (password.length > 64) problems.push('at most 64 characters');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/[0-9]/.test(password)) problems.push('a digit');
  return problems;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const problems = passwordProblems(form.password);
    if (problems.length) {
      setError(`Password needs ${problems.join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="name">Full name</label>
        <input id="name" value={form.name} onChange={set('name')} required />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
        <small>8-64 characters with an uppercase letter, a lowercase letter and a digit.</small>
        <label htmlFor="role">I am a</label>
        <select id="role" value={form.role} onChange={set('role')}>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
        </select>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Register'}</button>
      </form>
      <p>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
