import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';
import { renderWithAuth, users } from '../test/renderWithAuth';

describe('Navbar (role-aware navigation)', () => {
  test('visitors see login and register only', () => {
    renderWithAuth(<Navbar />, { user: null });
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Study Materials' })).not.toBeInTheDocument();
  });

  test('students do not see the Question Bank link', () => {
    renderWithAuth(<Navbar />, { user: users.student });
    expect(screen.getByRole('link', { name: 'Study Materials' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Question Bank' })).not.toBeInTheDocument();
  });

  test('only admins see the Manage Users link', () => {
    const { unmount } = renderWithAuth(<Navbar />, { user: users.admin });
    expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute('href', '/admin/users');
    unmount();
    for (const user of [users.student, users.instructor, null]) {
      const view = renderWithAuth(<Navbar />, { user });
      expect(screen.queryByRole('link', { name: 'Manage Users' })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  test('only admins see the Moderation link', () => {
    const { unmount } = renderWithAuth(<Navbar />, { user: users.admin });
    expect(screen.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/admin/moderation');
    unmount();
    for (const user of [users.student, users.instructor, null]) {
      const view = renderWithAuth(<Navbar />, { user });
      expect(screen.queryByRole('link', { name: 'Moderation' })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  test('instructors see the Question Bank link and can log out', async () => {
    const { auth } = renderWithAuth(<Navbar />, { user: users.instructor });
    expect(screen.getByRole('link', { name: 'Question Bank' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
