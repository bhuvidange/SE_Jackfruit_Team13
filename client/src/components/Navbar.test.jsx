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

  test('instructors see the Question Bank link and can log out', async () => {
    const { auth } = renderWithAuth(<Navbar />, { user: users.instructor });
    expect(screen.getByRole('link', { name: 'Question Bank' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
