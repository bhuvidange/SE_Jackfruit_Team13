import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminModeration from './AdminModeration';
import { mockFetch } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const materialReport = {
  id: 'r1',
  targetType: 'material',
  target: 'm1',
  reason: 'Contains spam',
  status: 'open',
  reporterName: 'Sam Student',
  createdAt: '2026-03-04T10:00:00.000Z',
  targetSummary: { title: 'TCP handshake', subject: 'Networks' },
};
const questionReport = {
  id: 'r2',
  targetType: 'question',
  target: 'q1',
  reason: 'Offensive wording',
  status: 'open',
  reporterName: 'Zed Student',
  createdAt: '2026-03-05T10:00:00.000Z',
  targetSummary: { text: 'What is 2 + 2?', subject: 'Maths' },
};
const gone = { ...questionReport, id: 'r3', targetSummary: null };

const list = (reports = [materialReport, questionReport]) => ({ match: /\/reports\?status=open$/, body: { reports } });
const calls = (fetchMock, method) => fetchMock.mock.calls.filter(([, o]) => o?.method === method).map(([u]) => u);

describe('TC-Admin-08 moderation page (CSMQP-F-051)', () => {
  test('lists open reports with type, item, reason, reporter and date', async () => {
    mockFetch([list()]);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    const row = (await screen.findByText('Contains spam')).closest('tr');
    expect(row).toHaveTextContent('material');
    expect(row).toHaveTextContent('TCP handshake (Networks)');
    expect(row).toHaveTextContent('Sam Student');
    expect(row).toHaveTextContent(new Date(materialReport.createdAt).toLocaleDateString());
    const qRow = screen.getByText('Offensive wording').closest('tr');
    expect(qRow).toHaveTextContent('question');
    expect(qRow).toHaveTextContent('What is 2 + 2? (Maths)');
  });

  test('a report whose item is gone is still listed', async () => {
    mockFetch([list([gone])]);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    expect(await screen.findByText('Item no longer available')).toBeInTheDocument();
  });

  test('empty state shows "No open reports"', async () => {
    mockFetch([list([])]);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    expect(await screen.findByText('No open reports')).toBeInTheDocument();
  });

  test('a load error is shown', async () => {
    mockFetch([{ match: /\/reports/, status: 500, body: { message: 'Internal server error' } }]);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });

  test('Remove asks for confirmation, calls PATCH remove and refreshes', async () => {
    let open = [materialReport, questionReport];
    const fetchMock = mockFetch([
      { method: 'PATCH', match: /\/reports\/r1\/remove$/, body: () => { open = [questionReport]; return { report: {} }; } },
      { match: /\/reports\?status=open$/, body: () => ({ reports: open }) },
    ]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: /^Remove reported material/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('The material was removed');
    expect(confirm).toHaveBeenCalled();
    expect(calls(fetchMock, 'PATCH')).toEqual([expect.stringMatching(/\/reports\/r1\/remove$/)]);
    expect(screen.queryByText('Contains spam')).not.toBeInTheDocument();
    expect(screen.getByText('Offensive wording')).toBeInTheDocument();
  });

  test('cancelling the confirmation sends nothing', async () => {
    const fetchMock = mockFetch([list()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: /^Remove reported material/ }));
    expect(calls(fetchMock, 'PATCH')).toHaveLength(0);
  });

  test('Dismiss calls PATCH dismiss without a confirmation and refreshes', async () => {
    const fetchMock = mockFetch([{ method: 'PATCH', match: /\/reports\/r2\/dismiss$/, body: { report: {} } }, list()]);
    const confirm = vi.spyOn(window, 'confirm');
    renderWithAuth(<AdminModeration />, { user: users.admin });
    const before = fetchMock.mock.calls.length;
    await userEvent.click(await screen.findByRole('button', { name: /^Dismiss report on What is 2/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Report dismissed');
    expect(confirm).not.toHaveBeenCalled();
    expect(calls(fetchMock, 'PATCH')).toEqual([expect.stringMatching(/\/reports\/r2\/dismiss$/)]);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before + 1);
  });

  test('an action error (question in a published quiz) is shown', async () => {
    mockFetch([
      { method: 'PATCH', match: /\/remove$/, status: 409, body: { message: 'This question is used in a published quiz and cannot be removed' } },
      list(),
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth(<AdminModeration />, { user: users.admin });
    await userEvent.click(await screen.findByRole('button', { name: /^Remove reported question/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('published quiz');
  });
});
