import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, qs } from '../services/api';

const ROLES = ['student', 'instructor', 'admin'];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (q, r) => {
    setLoading(true);
    try {
      const data = await api(`/admin/users${qs({ q, role: r })}`);
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('', '');
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    setError('');
    load(query.trim(), role);
  };

  const onRole = (e) => {
    setError('');
    setRole(e.target.value);
    load(query.trim(), e.target.value);
  };

  async function act(request, success) {
    setError('');
    setMessage('');
    try {
      await request();
      setMessage(success);
    } catch (err) {
      setError(err.message);
    }
    await load(query.trim(), role);
  }

  const onToggle = (u) => {
    const action = u.status === 'blocked' ? 'unblock' : 'block';
    return act(
      () => api(`/admin/users/${u.id}/${action}`, { method: 'PATCH' }),
      `${u.name} ${action === 'block' ? 'blocked' : 'unblocked'}`
    );
  };

  const onDelete = (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    return act(() => api(`/admin/users/${u.id}`, { method: 'DELETE' }), `${u.name} deleted`);
  };

  const canManage = (u) => u.id !== me.id && u.role !== 'admin';

  return (
    <div>
      <h1>Manage Users</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <form className="card" onSubmit={onSearch} role="search">
        <div className="row">
          <div>
            <label htmlFor="user-search">Search by name or email</label>
            <input id="user-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. alice" />
          </div>
          <div>
            <label htmlFor="user-role">Role</label>
            <select id="user-role" value={role} onChange={onRole}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button className="btn" type="submit">Search</button>
      </form>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : users.length === 0 ? (
          <p className="muted">No users found</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.status}</td>
                  <td>
                    {canManage(u) && (
                      <>
                        <button className="btn small" type="button" onClick={() => onToggle(u)} aria-label={`${u.status === 'blocked' ? 'Unblock' : 'Block'} ${u.name}`}>
                          {u.status === 'blocked' ? 'Unblock' : 'Block'}
                        </button>
                        <button className="btn small danger" type="button" onClick={() => onDelete(u)} aria-label={`Delete ${u.name}`}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
