import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import QuizAttempt, { formatClock } from './QuizAttempt';
import { mockFetch, sentBody } from '../test/mockFetch';
import { users } from '../test/renderWithAuth';

const questions = [
  { id: 'q1', type: 'mcq', text: 'First question?', options: ['A', 'B', 'C', 'D'] },
  { id: 'q2', type: 'tf', text: 'Second question?', options: ['True', 'False'] },
];

function startResponse(secondsAllowed) {
  const now = Date.now();
  return {
    attempt: { id: 'att1', status: 'in_progress', startedAt: new Date(now).toISOString(), expiresAt: new Date(now + secondsAllowed * 1000).toISOString() },
    serverTime: new Date(now).toISOString(),
    quiz: { id: 'quiz1', title: 'Fast quiz', timeLimitMinutes: 1, questions },
  };
}

function mount(routes) {
  localStorage.setItem('csmqp_token', 'test-token');
  const fetchMock = mockFetch(routes);
  render(
    <AuthContext.Provider value={{ user: users.student, token: 'test-token', loading: false }}>
      <MemoryRouter initialEntries={['/quizzes/quiz1/attempt']}>
        <Routes>
          <Route path="/quizzes/:id/attempt" element={<QuizAttempt />} />
          <Route path="/attempts/:attemptId" element={<p>result page</p>} />
          <Route path="/quizzes" element={<p>quiz list</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return fetchMock;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('TC-Quiz-02 countdown timer (CSMQP-F-031)', () => {
  beforeEach(() => vi.useFakeTimers());

  test('formatClock pads minutes and seconds and never goes negative', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(-4)).toBe('00:00');
  });

  test('shows the remaining time from the server deadline and counts down each second', async () => {
    mount([{ method: 'POST', match: /\/quizzes\/quiz1\/start/, body: startResponse(90) }]);
    await flush();
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('01:25');
  });

  test('a skewed local clock does not change the remaining time', async () => {
    const res = startResponse(60);
    // The server clock is 10 minutes ahead of this device; remaining time must still be 60 s.
    res.serverTime = new Date(Date.now() + 600000).toISOString();
    res.attempt.expiresAt = new Date(Date.now() + 600000 + 60000).toISOString();
    mount([{ method: 'POST', match: /\/quizzes\/quiz1\/start/, body: res }]);
    await flush();
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');
  });
});

describe('TC-Quiz-04 attempt, manual submit and auto-submit (CSMQP-F-033)', () => {
  beforeEach(() => vi.useFakeTimers());

  test('manual submit sends the chosen answers and opens the result', async () => {
    const fetchMock = mount([
      { method: 'POST', match: /\/start/, body: startResponse(120) },
      { method: 'POST', match: /\/submit/, body: { attempt: { id: 'att1' } } },
    ]);
    await flush();
    fireEvent.click(screen.getByLabelText('B'));
    fireEvent.click(screen.getByLabelText('False'));
    expect(screen.getByText('(2/2 answered)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit quiz' }));
    await flush();

    const call = fetchMock.mock.calls.find(([u]) => u.includes('/submit'));
    expect(sentBody(call).answers).toEqual([
      { questionId: 'q1', selected: 1 },
      { questionId: 'q2', selected: 1 },
    ]);
    expect(screen.getByText('result page')).toBeInTheDocument();
  });

  test('auto-submits with the answers given so far when the timer reaches zero', async () => {
    const fetchMock = mount([
      { method: 'POST', match: /\/start/, body: startResponse(3) },
      { method: 'POST', match: /\/submit/, body: { attempt: { id: 'att1' } } },
    ]);
    await flush();
    fireEvent.click(screen.getByLabelText('C')); // answers only the first question
    expect(fetchMock.mock.calls.filter(([u]) => u.includes('/submit'))).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    const submits = fetchMock.mock.calls.filter(([u]) => u.includes('/submit'));
    expect(submits).toHaveLength(1);
    expect(sentBody(submits[0]).answers).toEqual([
      { questionId: 'q1', selected: 2 },
      { questionId: 'q2', selected: null },
    ]);
    expect(screen.getByText('result page')).toBeInTheDocument();
  });

  test('the timer is red when one minute or less remains', async () => {
    mount([{ method: 'POST', match: /\/start/, body: startResponse(45) }]);
    await flush();
    expect(screen.getByRole('timer')).toHaveClass('low');
  });

  test('auto-submit happens only once even if time keeps passing', async () => {
    const fetchMock = mount([
      { method: 'POST', match: /\/start/, body: startResponse(2) },
      { method: 'POST', match: /\/submit/, status: 400, body: { message: 'Submission rejected: the time limit has passed' } },
    ]);
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetchMock.mock.calls.filter(([u]) => u.includes('/submit'))).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Time is up. Submission rejected');
  });

  test('a quiz already submitted redirects to its result', async () => {
    mount([{ method: 'POST', match: /\/start/, status: 409, body: { message: 'You have already submitted this quiz', attemptId: 'att9' } }]);
    await flush();
    expect(screen.getByText('result page')).toBeInTheDocument();
  });

  test('an expired attempt shows the server message and a way back', async () => {
    mount([{ method: 'POST', match: /\/start/, status: 409, body: { message: 'Your time for this quiz has run out', attemptId: 'att9' } }]);
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Your time for this quiz has run out');
    expect(screen.getByRole('link', { name: 'Back to quizzes' })).toBeInTheDocument();
  });
});
