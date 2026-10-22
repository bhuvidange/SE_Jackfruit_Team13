import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { renderWithAuth, users } from '../test/renderWithAuth';

const ui = (
  <Routes>
    <Route path="/login" element={<p>login page</p>} />
    <Route path="/secret" element={<ProtectedRoute><p>secret content</p></ProtectedRoute>} />
    <Route path="/staff" element={<ProtectedRoute roles={['instructor']}><p>staff content</p></ProtectedRoute>} />
  </Routes>
);

describe('TC-Auth-05 ProtectedRoute (CSMQP-F-003)', () => {
  test('anonymous visitors are sent to the login page', () => {
    renderWithAuth(ui, { user: null, route: '/secret' });
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  test('signed-in users see the page', () => {
    renderWithAuth(ui, { user: users.student, route: '/secret' });
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  test('a wrong role gets an access denied message', () => {
    renderWithAuth(ui, { user: users.student, route: '/staff' });
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('staff content')).not.toBeInTheDocument();
  });

  test('the right role passes', () => {
    renderWithAuth(ui, { user: users.instructor, route: '/staff' });
    expect(screen.getByText('staff content')).toBeInTheDocument();
  });

  test('nothing is decided while the session is still loading', () => {
    renderWithAuth(ui, { user: null, loading: true, route: '/secret' });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
