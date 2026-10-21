import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import Login from './Login';
import { renderWithAuth, users } from '../test/renderWithAuth';

const ui = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<p>home page</p>} />
  </Routes>
);

describe('TC-Auth-03 login page (CSMQP-F-002)', () => {
  test('submits the trimmed email and password, then goes to the home page', async () => {
    const login = vi.fn().mockResolvedValue(users.student);
    renderWithAuth(ui, { user: null, route: '/login', auth: { login } });

    await userEvent.type(screen.getByLabelText('Email'), '  sam@test.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith('sam@test.com', 'Passw0rd!');
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  test('TC-Auth-04 shows the server error for invalid credentials and stays on the page', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    renderWithAuth(ui, { user: null, route: '/login', auth: { login } });

    await userEvent.type(screen.getByLabelText('Email'), 'sam@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled());
  });

  test('an already logged-in user is redirected away from the login page', () => {
    renderWithAuth(ui, { user: users.student, route: '/login' });
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  test('links to registration', () => {
    renderWithAuth(ui, { user: null, route: '/login' });
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });
});
