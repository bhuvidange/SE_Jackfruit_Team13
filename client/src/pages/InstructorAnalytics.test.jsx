
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstructorAnalytics from './InstructorAnalytics';
import { mockFetch } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const quizzes = [
  { id: 'q1', title: 'Algorithms Quiz' },
  { id: 'q2', title: 'Database Quiz' },
];

const analytics = {
  quiz: {
    title: 'Algorithms Quiz',
    questionCount: 2,
  },
  attempts: 2,
  averageScore: 75,
  highestScore: 100,
  lowestScore: 50,
  scoreDistribution: [
    { label: '0–20%', min: 0, max: 20, count: 0 },
    { label: '21–40%', min: 21, max: 40, count: 0 },
    { label: '41–60%', min: 41, max: 60, count: 1 },
    { label: '61–80%', min: 61, max: 80, count: 0 },
    { label: '81–100%', min: 81, max: 100, count: 1 },
  ],
  perQuestion: [
    {
      questionId: 'question1',
      text: 'What is a sorting algorithm?',
      correctCount: 1,
      totalResponses: 2,
      percentageCorrect: 50,
    },
    {
      questionId: 'question2',
      text: 'What is a database?',
      correctCount: 2,
      totalResponses: 2,
      percentageCorrect: 100,
    },
  ],
};

const listQuizzes = {
  match: /\/analytics\/instructor\/quizzes$/,
  body: { quizzes },
};

const renderAnalytics = () =>
  renderWithAuth(<InstructorAnalytics />, {
    user: users.instructor,
  });

describe('Instructor Analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loading state while quizzes are being fetched', async () => {
    mockFetch([
      {
        match: /\/analytics\/instructor\/quizzes$/,
        body: { quizzes: [] },
      },
    ]);

    renderAnalytics();

    expect(
      screen.getByText(/loading/i)
    ).toBeInTheDocument();
  });

  it('loads quiz analytics and displays statistics and question details', async () => {
    mockFetch([
      listQuizzes,
      {
        match: /\/analytics\/instructor\/quizzes\/q1$/,
        body: analytics,
      },
    ]);

    renderAnalytics();

    expect(
      await screen.findByRole('heading', { name: 'Algorithms Quiz' })
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Total Attempts')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Average Score')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Highest Score')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Lowest Score')
    ).toBeInTheDocument();

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);

    expect(
      screen.getByText('What is a sorting algorithm?')
    ).toBeInTheDocument();

    expect(
      screen.getByText('What is a database?')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Score Distribution')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Question-wise Correctness')
    ).toBeInTheDocument();
  });

  it('loads analytics for the newly selected quiz', async () => {
    const user = userEvent.setup();

    mockFetch([
      listQuizzes,
      {
        match: /\/analytics\/instructor\/quizzes\/q1$/,
        body: analytics,
      },
      {
        match: /\/analytics\/instructor\/quizzes\/q2$/,
        body: {
          quiz: {
            title: 'Database Quiz',
            questionCount: 1,
          },
          attempts: 1,
          averageScore: 100,
          highestScore: 100,
          lowestScore: 100,
          scoreDistribution: [
            { label: '0–20%', min: 0, max: 20, count: 0 },
            { label: '21–40%', min: 21, max: 40, count: 0 },
            { label: '41–60%', min: 41, max: 60, count: 0 },
            { label: '61–80%', min: 61, max: 80, count: 0 },
            { label: '81–100%', min: 81, max: 100, count: 1 },
          ],
          perQuestion: [],
        },
      },
    ]);

    renderAnalytics();

    await screen.findByRole('heading', { name: 'Algorithms Quiz' });

    await user.selectOptions(
      screen.getByLabelText('Select a quiz'),
      'q2'
    );

    expect(
      await screen.findByRole('heading', { name: 'Database Quiz' })
    ).toBeInTheDocument();

    expect(screen.getByText('1 questions')).toBeInTheDocument();
  });

  it('shows a message when the instructor has no quizzes', async () => {
    mockFetch([
      {
        match: /\/analytics\/instructor\/quizzes$/,
        body: { quizzes: [] },
      },
    ]);

    renderAnalytics();

    expect(
      await screen.findByText(/no quizzes/i)
    ).toBeInTheDocument();
  });

  it('shows an error when loading quizzes fails', async () => {
    mockFetch([
      {
        match: /\/analytics\/instructor\/quizzes$/,
        status: 500,
        body: { message: 'Failed to load quizzes' },
      },
    ]);

    renderAnalytics();

    expect(
      await screen.findByText(/failed to load quizzes/i)
    ).toBeInTheDocument();
  });

  it('shows an error when loading quiz analytics fails', async () => {
    mockFetch([
      listQuizzes,
      {
        match: /\/analytics\/instructor\/quizzes\/q1$/,
        status: 500,
        body: { message: 'Failed to load analytics' },
      },
    ]);

    renderAnalytics();

    expect(
      await screen.findByText('Algorithms Quiz')
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/failed to load analytics/i)
    ).toBeInTheDocument();
  });

  it('shows the empty-attempt message and no-question-data message', async () => {
    mockFetch([
      listQuizzes,
      {
        match: /\/analytics\/instructor\/quizzes\/q1$/,
        body: {
          quiz: {
            title: 'Algorithms Quiz',
            questionCount: 0,
          },
          attempts: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          scoreDistribution: [],
          perQuestion: [],
        },
      },
    ]);

    renderAnalytics();

    expect(
      await screen.findByText(/no students have submitted this quiz yet/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no question data available/i)
    ).toBeInTheDocument();
  });
});
