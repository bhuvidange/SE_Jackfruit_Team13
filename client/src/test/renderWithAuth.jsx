import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';

export const users = {
  student: { id: 's1', name: 'Sam Student', email: 'sam@test.com', role: 'student' },
  instructor: { id: 'i1', name: 'Ira Instructor', email: 'ira@test.com', role: 'instructor' },
  admin: { id: 'a1', name: 'Ada Admin', email: 'ada@test.com', role: 'admin' },
};

/** Renders `ui` inside a router and a fake auth context. Pass `user: null` for a logged-out visitor. */
export function renderWithAuth(ui, { user = users.student, route = '/', loading = false, auth = {} } = {}) {
  localStorage.setItem('csmqp_token', 'test-token');
  const value = {
    user,
    token: user ? 'test-token' : null,
    loading,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...auth,
  };
  return {
    auth: value,
    ...render(
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    ),
  };
}
