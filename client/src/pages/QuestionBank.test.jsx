import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionBank from './QuestionBank';
import { mockFetch, sentBody } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const existing = {
  id: 'q1',
  type: 'mcq',
  text: 'Which structure is FIFO?',
  options: ['Stack', 'Queue', 'Tree', 'Graph'],
  correctAnswer: 1,
  subject: 'Data Structures',
  topic: 'Queues',
  difficulty: 'easy',
  owner: users.instructor.id,
};

describe('TC-QB-01 add a question (CSMQP-F-020)', () => {
  test('posts a complete MCQ and reloads the list', async () => {
    const fetchMock = mockFetch([
      { match: /\/questions$/, body: { questions: [] } },
      { method: 'POST', match: /\/questions$/, status: 201, body: { question: existing } },
    ]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await screen.findByText('No questions found.');

    await userEvent.type(screen.getByLabelText('Question'), 'Which structure is FIFO?');
    const names = ['Stack', 'Queue', 'Tree', 'Graph'];
    for (let i = 0; i < names.length; i++) await userEvent.type(screen.getByLabelText(`Option ${i + 1}`), names[i]);
    await userEvent.click(screen.getByLabelText('Option 2 is correct'));
    await userEvent.type(screen.getByLabelText('Subject', { selector: '#q-subject' }), 'Data Structures');
    await userEvent.type(screen.getByLabelText('Topic', { selector: '#q-topic' }), 'Queues');
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Question added');
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(sentBody(post)).toMatchObject({ type: 'mcq', correctAnswer: 1, options: ['Stack', 'Queue', 'Tree', 'Graph'], difficulty: 'easy' });
  });

  test('server validation errors are displayed', async () => {
    mockFetch([
      { match: /\/questions$/, body: { questions: [] } },
      { method: 'POST', match: /\/questions$/, status: 400, body: { message: 'Subject is required' } },
    ]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await screen.findByText('No questions found.');
    await userEvent.type(screen.getByLabelText('Question'), 'x');
    await userEvent.type(screen.getByLabelText('Subject', { selector: '#q-subject' }), 's');
    await userEvent.type(screen.getByLabelText('Topic', { selector: '#q-topic' }), 't');
    for (let i = 1; i <= 4; i++) await userEvent.type(screen.getByLabelText(`Option ${i}`), `o${i}`);
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Subject is required');
  });
});

describe('TC-QB-02 MCQ needs four options, True/False two (CSMQP-F-021)', () => {
  test('MCQ with a blank option is blocked before any request is sent', async () => {
    const fetchMock = mockFetch([{ match: /\/questions$/, body: { questions: [] } }]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await screen.findByText('No questions found.');
    await userEvent.type(screen.getByLabelText('Question'), 'x');
    await userEvent.type(screen.getByLabelText('Option 1'), 'only one');
    await userEvent.type(screen.getByLabelText('Subject', { selector: '#q-subject' }), 's');
    await userEvent.type(screen.getByLabelText('Topic', { selector: '#q-topic' }), 't');
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fill in all four options');
    expect(fetchMock.mock.calls.every(([, o]) => !o?.method || o.method === 'GET')).toBe(true);
  });

  test('switching to True/False shows exactly two fixed options', async () => {
    mockFetch([{ match: /\/questions$/, body: { questions: [] } }]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await screen.findByText('No questions found.');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'tf');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('True')).toBeInTheDocument();
    expect(screen.getByText('False')).toBeInTheDocument();
  });
});

describe('TC-QB-03 filter by tags (CSMQP-F-022)', () => {
  test('applying filters sends them as query parameters', async () => {
    const fetchMock = mockFetch([{ match: /\/questions/, body: { questions: [existing] } }]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await screen.findByText('Which structure is FIFO?');

    await userEvent.type(screen.getByLabelText('Subject', { selector: '#f-subject' }), 'Data Structures');
    await userEvent.selectOptions(screen.getByLabelText('Difficulty', { selector: '#f-difficulty' }), 'hard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => {
      const last = fetchMock.mock.calls.at(-1)[0];
      expect(last).toContain('subject=Data+Structures');
      expect(last).toContain('difficulty=hard');
    });
  });
});

describe('TC-QB-04 edit and delete (CSMQP-F-023)', () => {
  test('edit loads the question into the form and saves with PUT', async () => {
    const fetchMock = mockFetch([
      { match: /\/questions$/, body: { questions: [existing] } },
      { method: 'PUT', match: /\/questions\/q1$/, body: { question: existing } },
    ]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Question')).toHaveValue('Which structure is FIFO?');
    await userEvent.clear(screen.getByLabelText('Question'));
    await userEvent.type(screen.getByLabelText('Question'), 'Updated?');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Question updated');
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(sentBody(put).text).toBe('Updated?');
  });

  test('delete asks for confirmation and shows the server refusal for published quizzes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch([
      { match: /\/questions$/, body: { questions: [existing] } },
      { method: 'DELETE', match: /\/questions\/q1$/, status: 409, body: { message: 'This question is used in a published quiz and cannot be deleted' } },
    ]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/published quiz/);
    expect(screen.getByText('Which structure is FIFO?')).toBeInTheDocument();
  });

  test('declining the confirmation sends nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = mockFetch([{ match: /\/questions$/, body: { questions: [existing] } }]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false);
  });

  test('other instructors\' questions have no edit/delete buttons', async () => {
    mockFetch([{ match: /\/questions$/, body: { questions: [{ ...existing, owner: 'someone-else' }] } }]);
    renderWithAuth(<QuestionBank />, { user: users.instructor });
    const row = (await screen.findByText('Which structure is FIFO?')).closest('tr');
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  test('admins can read the bank but have no form', async () => {
    mockFetch([{ match: /\/questions$/, body: { questions: [existing] } }]);
    renderWithAuth(<QuestionBank />, { user: users.admin });
    await screen.findByText('Which structure is FIFO?');
    expect(screen.queryByRole('form', { name: 'Question form' })).not.toBeInTheDocument();
  });
});
