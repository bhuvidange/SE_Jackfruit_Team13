import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import QuizCreate from './QuizCreate';
import QuizList from './QuizList';
import QuizResult from './QuizResult';
import { mockFetch, sentBody } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const bank = [
  { id: 'q1', text: 'Question one', subject: 'Maths', topic: 'Algebra', difficulty: 'easy' },
  { id: 'q2', text: 'Question two', subject: 'Maths', topic: 'Geometry', difficulty: 'hard' },
];

describe('TC-Quiz-01 create a quiz from the bank (CSMQP-F-030/031)', () => {
  const ui = (
    <Routes>
      <Route path="/quizzes/new" element={<QuizCreate />} />
      <Route path="/quizzes" element={<p>quiz list page</p>} />
    </Routes>
  );

  async function fillBasics(title = 'Midterm', minutes = '15') {
    await screen.findByText('Question one');
    await userEvent.type(screen.getByLabelText('Title'), title);
    await userEvent.clear(screen.getByLabelText('Time limit (minutes)'));
    await userEvent.type(screen.getByLabelText('Time limit (minutes)'), minutes);
  }

  test('posts the selected question ids and time limit, then opens the list', async () => {
    const fetchMock = mockFetch([
      { match: /\/questions/, body: { questions: bank } },
      { method: 'POST', match: /\/quizzes$/, status: 201, body: { quiz: { id: 'z1' } } },
    ]);
    renderWithAuth(ui, { user: users.instructor, route: '/quizzes/new' });
    await fillBasics();
    await userEvent.click(screen.getByLabelText(/Question two/));
    await userEvent.click(screen.getByLabelText(/Question one/));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create quiz' }));

    expect(await screen.findByText('quiz list page')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(sentBody(post)).toEqual({ title: 'Midterm', questionIds: ['q2', 'q1'], timeLimitMinutes: 15 });
  });

  test('requires at least one question', async () => {
    mockFetch([{ match: /\/questions/, body: { questions: bank } }]);
    renderWithAuth(ui, { user: users.instructor, route: '/quizzes/new' });
    await fillBasics();
    await userEvent.click(screen.getByRole('button', { name: 'Create quiz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one question');
  });

  test.each(['0', '301', '1.5'])('time limit %s is rejected client-side', async (minutes) => {
    mockFetch([{ match: /\/questions/, body: { questions: bank } }]);
    renderWithAuth(ui, { user: users.instructor, route: '/quizzes/new' });
    await fillBasics('T', minutes);
    await userEvent.click(screen.getByLabelText(/Question one/));
    await userEvent.click(screen.getByRole('button', { name: 'Create quiz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/between 1 and 300/);
  });

  test('the bank can be filtered by subject', async () => {
    const fetchMock = mockFetch([{ match: /\/questions/, body: { questions: bank } }]);
    renderWithAuth(ui, { user: users.instructor, route: '/quizzes/new' });
    await screen.findByText('Question one');
    await userEvent.type(screen.getByLabelText('Filter by subject'), 'Maths');
    expect(fetchMock.mock.calls.at(-1)[0]).toContain('subject=Maths');
  });
});

describe('TC-Quiz-03 quiz list (CSMQP-F-032)', () => {
  const quiz = { id: 'z1', title: 'Week 1', questionCount: 5, timeLimitMinutes: 10, published: false };

  test('instructor sees drafts with a Publish button and it publishes', async () => {
    const fetchMock = mockFetch([
      { match: /\/quizzes$/, body: { quizzes: [quiz] } },
      { method: 'POST', match: /\/quizzes\/z1\/publish/, body: { quiz: { ...quiz, published: true } } },
    ]);
    renderWithAuth(<QuizList />, { user: users.instructor });
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('"Week 1" is now published');
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, o]) => u.endsWith('/quizzes/z1/publish') && o.method === 'POST')).toBe(true);
  });

  test('a publish failure is displayed', async () => {
    mockFetch([
      { match: /\/quizzes$/, body: { quizzes: [quiz] } },
      { method: 'POST', match: /\/publish/, status: 409, body: { message: 'Some questions in this quiz were deleted from the bank' } },
    ]);
    renderWithAuth(<QuizList />, { user: users.instructor });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/deleted from the bank/);
  });

  test('student sees Start, Resume, View result and expired states', async () => {
    const published = { ...quiz, published: true };
    mockFetch([
      {
        match: /\/quizzes$/,
        body: {
          quizzes: [
            { ...published, id: 'a', title: 'New', attempt: null },
            { ...published, id: 'b', title: 'Going', attempt: { id: 'x', status: 'in_progress' } },
            { ...published, id: 'c', title: 'Done', attempt: { id: 'y', status: 'submitted', score: 3, total: 5 } },
            { ...published, id: 'd', title: 'Late', attempt: { id: 'z', status: 'expired' } },
          ],
        },
      },
    ]);
    renderWithAuth(<QuizList />, { user: users.student });
    await screen.findByText('New');
    const row = (t) => screen.getByText(t).closest('tr');
    expect(within(row('New')).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/quizzes/a/attempt');
    expect(within(row('Going')).getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(within(row('Done')).getByRole('link', { name: 'View result' })).toHaveAttribute('href', '/attempts/y');
    expect(row('Done')).toHaveTextContent('3/5');
    expect(row('Late')).toHaveTextContent('Time expired');
    expect(screen.queryByRole('link', { name: 'Create a quiz' })).not.toBeInTheDocument();
  });

  test('empty states', async () => {
    mockFetch([{ match: /\/quizzes$/, body: { quizzes: [] } }]);
    renderWithAuth(<QuizList />, { user: users.student });
    expect(await screen.findByText('No quizzes are available right now.')).toBeInTheDocument();
  });
});

describe('TC-Quiz-06 result page (CSMQP-F-035)', () => {
  const attempt = {
    id: 'att1',
    quizTitle: 'Week 1',
    score: 1,
    total: 2,
    percentage: 50,
    results: [
      { questionId: 'q1', text: 'Capital of France?', options: ['Berlin', 'Paris'], selected: 1, correctAnswer: 1, correct: true },
      { questionId: 'q2', text: 'Capital of Spain?', options: ['Madrid', 'Rome'], selected: 1, correctAnswer: 0, correct: false },
    ],
  };
  const ui = (
    <Routes>
      <Route path="/attempts/:attemptId" element={<QuizResult />} />
    </Routes>
  );

  test('shows the score and per-question correctness', async () => {
    mockFetch([{ match: /\/quizzes\/attempts\/att1/, body: { attempt } }]);
    renderWithAuth(ui, { route: '/attempts/att1' });
    expect(await screen.findByTestId('score')).toHaveTextContent('1 / 2');
    expect(screen.getByText('50%', { exact: false })).toBeInTheDocument();
    const first = screen.getByRole('region', { name: 'Question 1' });
    const second = screen.getByRole('region', { name: 'Question 2' });
    expect(first).toHaveTextContent('Correct');
    expect(second).toHaveTextContent('Incorrect');
    expect(second).toHaveTextContent('Madrid (correct answer)');
    expect(second).toHaveTextContent('Rome (your answer)');
  });

  test('unanswered questions are labelled', async () => {
    const unanswered = { ...attempt, results: [{ ...attempt.results[1], selected: null }] };
    mockFetch([{ match: /\/quizzes\/attempts\/att1/, body: { attempt: unanswered } }]);
    renderWithAuth(ui, { route: '/attempts/att1' });
    expect(await screen.findByText('Not answered')).toBeInTheDocument();
  });

  test('access errors are displayed', async () => {
    mockFetch([{ match: /\/quizzes\/attempts\/att1/, status: 403, body: { message: 'You cannot view this attempt' } }]);
    renderWithAuth(ui, { route: '/attempts/att1' });
    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot view this attempt');
  });
});
