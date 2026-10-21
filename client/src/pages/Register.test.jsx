import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import Register, { passwordProblems } from './Register';
import { renderWithAuth, users } from '../test/renderWithAuth';

const ui = (
  <Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/" element={<p>home page</p>} />
  </Routes>
);

async function fill({ name = 'Asha', email = 'asha@test.com', password = 'Passw0rd!', role } = {}) {
  await userEvent.type(screen.getByLabelText('Full name'), name);
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  if (role) await userEvent.selectOptions(screen.getByLabelText('I am a'), role);
  await userEvent.click(screen.getByRole('button', { name: 'Register' }));
}

describe('TC-Auth-01 register page (CSMQP-F-001)', () => {
  test('submits the form and lands on the home page', async () => {
    const register = vi.fn().mockResolvedValue(users.instructor);
    renderWithAuth(ui, { user: null, route: '/register', auth: { register } });
    await fill({ role: 'instructor' });
    expect(register).toHaveBeenCalledWith({ name: 'Asha', email: 'asha@test.com', password: 'Passw0rd!', role: 'instructor' });
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });
});

describe('TC-Auth-02 register validation (CSMQP-F-001)', () => {
  test('a weak password is blocked client-side with the reasons', async () => {
    const register = vi.fn();
    renderWithAuth(ui, { user: null, route: '/register', auth: { register } });
    await fill({ password: 'short' });
    expect(register).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters.*uppercase.*digit/);
  });

  test('a duplicate email error from the server is displayed', async () => {
    const register = vi.fn().mockRejectedValue(new Error('Email is already registered'));
    renderWithAuth(ui, { user: null, route: '/register', auth: { register } });
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered');
  });

  test('passwordProblems boundaries: 7 chars fails, 8 passes, 64 passes, 65 fails', () => {
    expect(passwordProblems('Abcde1x')).toContain('at least 8 characters');
    expect(passwordProblems('Abcdef1x')).toEqual([]);
    expect(passwordProblems('Aa1' + 'x'.repeat(61))).toEqual([]);
    expect(passwordProblems('Aa1' + 'x'.repeat(62))).toContain('at most 64 characters');
  });
});
