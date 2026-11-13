
const request = require('supertest');

const {
  app,
  connect,
  disconnect,
  clearAll,
  createUser,
  bearer,
} = require('./helpers');

const Question = require('../src/models/Question');
const Quiz = require('../src/models/Quiz');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

async function createPublishedQuiz(instructorToken, title, topic) {
  const me = await request(app)
    .get('/api/auth/me')
    .set(bearer(instructorToken));

  const question = await Question.create({
    type: 'mcq',
    text: `Question about ${topic}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    subject: 'Computer Science',
    topic,
    difficulty: 'easy',
    owner: me.body.user.id,
  });

  const quiz = await Quiz.create({
    title,
    instructor: question.owner,
    questions: [question._id],
    timeLimitMinutes: 10,
    published: true,
    publishedAt: new Date(),
  });

  return { quiz, question };
}

async function submitQuiz(studentToken, quiz, question, selected) {
  const started = await request(app)
    .post(`/api/quizzes/${quiz._id}/start`)
    .set(bearer(studentToken));

  if (started.status !== 200) {
    throw new Error(`Could not start quiz: ${JSON.stringify(started.body)}`);
  }

  return request(app)
    .post(`/api/quizzes/${quiz._id}/submit`)
    .set(bearer(studentToken))
    .send({
      answers: [
        {
          questionId: String(question._id),
          selected,
        },
      ],
    });
}

describe('Student Analytics API (CSMQP-F-040)', () => {
  test('returns dashboard statistics for the logged-in student', async () => {
    const instructor = await createUser('instructor');
    const student = await createUser('student');

    const { quiz, question } = await createPublishedQuiz(
      instructor.token,
      'DSA Quiz',
      'Arrays'
    );

    const submission = await submitQuiz(
      student.token,
      quiz,
      question,
      0
    );

    expect(submission.status).toBe(200);

    const response = await request(app)
      .get('/api/analytics/student')
      .set(bearer(student.token));

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      quizzesTaken: 1,
      averageScore: 100,
    });

    expect(response.body.recentResults).toHaveLength(1);

    expect(response.body.recentResults[0]).toMatchObject({
      quizTitle: 'DSA Quiz',
      score: 1,
      total: 1,
      percentage: 100,
    });
  });

  test('identifies topics with accuracy below 60%', async () => {
    const instructor = await createUser('instructor');
    const student = await createUser('student');

    const { quiz, question } = await createPublishedQuiz(
      instructor.token,
      'DBMS Quiz',
      'Transactions'
    );

    const submission = await submitQuiz(
      student.token,
      quiz,
      question,
      1
    );

    expect(submission.status).toBe(200);

    const response = await request(app)
      .get('/api/analytics/student')
      .set(bearer(student.token));

    expect(response.status).toBe(200);

    expect(response.body.weakTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topic: 'Transactions',
          accuracy: 0,
        }),
      ])
    );
  });

  test('does not include another student’s attempts', async () => {
    const instructor = await createUser('instructor');
    const student1 = await createUser('student');
    const student2 = await createUser('student');

    const { quiz, question } = await createPublishedQuiz(
      instructor.token,
      'OS Quiz',
      'Processes'
    );

    const submission = await submitQuiz(
      student1.token,
      quiz,
      question,
      0
    );

    expect(submission.status).toBe(200);

    const response = await request(app)
      .get('/api/analytics/student')
      .set(bearer(student2.token));

    expect(response.status).toBe(200);
    expect(response.body.quizzesTaken).toBe(0);
    expect(response.body.averageScore).toBe(0);
    expect(response.body.recentResults).toHaveLength(0);
    expect(response.body.weakTopics).toHaveLength(0);
  });

  test('requires authentication', async () => {
    const response = await request(app)
      .get('/api/analytics/student');

    expect(response.status).toBe(401);
  });

  test('instructors cannot access the student dashboard endpoint', async () => {
    const instructor = await createUser('instructor');

    const response = await request(app)
      .get('/api/analytics/student')
      .set(bearer(instructor.token));

    expect(response.status).toBe(403);
  });
});
