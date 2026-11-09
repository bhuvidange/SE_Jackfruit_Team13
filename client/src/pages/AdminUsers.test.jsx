import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsers from './AdminUsers';
import { mockFetch } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const sam = { id: 's1', name: 'Sam Student', email: 'sam@test.com', role: 'student', status: 'active' };
const ira = { id: 'i1', name: 'Ira Instructor', email: 'ira@test.com', role: 'instructor', status: 'blocked' };
const ada = { id: 'a1', name: 'Ada Admin', email: 'ada@test.com', role: 'admin', status: 'active' };
const bob = { id: 'a2', name: 'Bob Admin', email: 'bob@test.com', role: 'admin', status: 'active' };

const list = (all = [ada, bob, sam, ira]) => ({ match: /\/admin\/users(\?|$)/, body: (url) => ({ users: url.includes('q=zzz') ? [] : all }) });
const rowOf = (name) => screen.getByText(name).closest('tr');
const calls = (fetchMock, method) => fetchMock.mock.calls.filter(([, o]) => o?.method === method).map(([u]) => u);

describe('TC-Admin-06 user list (CSMQP-F-050)', () => {
  test('renders name, email, role and status for every user', async () => {
    mockFetch([list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    expect(await screen.findByText('Sam Student')).toBeInTheDocument();
    const row = rowOf('Sam Student');
    expect(row).toHaveTextContent('sam@test.com');
    expect(row).toHaveTextContent('student');
    expect(row).toHaveTextContent('active');
    expect(rowOf('Ira Instructor')).toHaveTextContent('blocked');
  });

  test('searching calls the API with q', async () => {
    const fetchMock = mockFetch([list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await screen.findByText('Sam Student');
    await userEvent.type(screen.getByLabelText('Search by name or email'), 'sam');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)[0]).toContain('/admin/users?q=sam'));
  });

  test('choosing a role filters through the API', async () => {
    const fetchMock = mockFetch([list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await screen.findByText('Sam Student');
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'instructor');
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)[0]).toContain('/admin/users?role=instructor'));
  });

  test('empty result shows "No users found"', async () => {
    mockFetch([list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await screen.findByText('Sam Student');
    await userEvent.type(screen.getByLabelText('Search by name or email'), 'zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  test('a load error is shown', async () => {
    mockFetch([{ match: /\/admin\/users/, status: 500, body: { message: 'Internal server error' } }]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });
});

describe('TC-Admin-07 actions', () => {
  test('no buttons on your own row or on other admins', async () => {
    mockFetch([list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await screen.findByText('Sam Student');
    expect(within(rowOf('Ada Admin')).queryAllByRole('button')).toHaveLength(0);
    expect(within(rowOf('Bob Admin')).queryAllByRole('button')).toHaveLength(0);
    expect(within(rowOf('Sam Student')).getAllByRole('button')).toHaveLength(2);
  });

  test('Block calls PATCH block, then refreshes the list', async () => {
    const fetchMock = mockFetch([{ method: 'PATCH', match: /\/admin\/users\/s1\/block$/, body: { user: { ...sam, status: 'blocked' } } }, list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    const before = fetchMock.mock.calls.length;
    await userEvent.click(await screen.findByRole('button', { name: 'Block Sam Student' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sam Student blocked');
    expect(calls(fetchMock, 'PATCH')).toEqual([expect.stringMatching(/\/admin\/users\/s1\/block$/)]);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before + 1);
  });

  test('Unblock calls PATCH unblock', async () => {
    const fetchMock = mockFetch([{ method: 'PATCH', match: /\/admin\/users\/i1\/unblock$/, body: { user: { ...ira, status: 'active' } } }, list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Unblock Ira Instructor' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Ira Instructor unblocked');
    expect(calls(fetchMock, 'PATCH')).toEqual([expect.stringMatching(/\/admin\/users\/i1\/unblock$/)]);
  });

  test('confirming Delete calls DELETE and reloads', async () => {
    const fetchMock = mockFetch([{ method: 'DELETE', match: /\/admin\/users\/s1$/, body: { message: 'User deleted' } }, list()]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Sam Student' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sam Student deleted');
    expect(confirm).toHaveBeenCalled();
    expect(calls(fetchMock, 'DELETE')).toEqual([expect.stringMatching(/\/admin\/users\/s1$/)]);
  });

  test('cancelling the confirmation sends nothing', async () => {
    const fetchMock = mockFetch([list()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Sam Student' }));
    expect(calls(fetchMock, 'DELETE')).toHaveLength(0);
  });

  test('an action error is shown', async () => {
    mockFetch([{ method: 'PATCH', match: /\/block$/, status: 403, body: { message: 'You cannot block or delete another administrator' } }, list()]);
    renderWithAuth(<AdminUsers />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Block Sam Student' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('another administrator');
  });
});
