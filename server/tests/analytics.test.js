
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


describe('Instructor Analytics API (CSMQP-F-041, F-042)', () => {
  test('returns analytics for the instructor’s own quiz', async () => {
    const instructor = await createUser('instructor');
    const student1 = await createUser('student');
    const student2 = await createUser('student');

    const { quiz, question } = await createPublishedQuiz(
      instructor.token,
      'DSA Analytics Quiz',
      'Arrays'
    );

    const submission1 = await submitQuiz(
      student1.token,
      quiz,
      question,
      0
    );

    const submission2 = await submitQuiz(
      student2.token,
      quiz,
      question,
      1
    );

    expect(submission1.status).toBe(200);
    expect(submission2.status).toBe(200);

    const response = await request(app)
      .get(`/api/analytics/instructor/quizzes/${quiz._id}`)
      .set(bearer(instructor.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      attempts: 2,
      averageScore: 50,
      highestScore: 100,
      lowestScore: 0,
    });

    expect(response.body.scoreDistribution).toHaveLength(5);
    expect(response.body.scoreDistribution.reduce(
      (sum, bucket) => sum + bucket.count, 0
    )).toBe(2);

    expect(response.body.perQuestion).toHaveLength(1);
    expect(response.body.perQuestion[0]).toMatchObject({
      text: `Question about Arrays`,
      correctCount: 1,
      totalResponses: 2,
      percentageCorrect: 50,
    });
  });

  test('blocks another instructor from viewing the quiz analytics', async () => {
    const owner = await createUser('instructor');
    const otherInstructor = await createUser('instructor');

    const { quiz } = await createPublishedQuiz(
      owner.token,
      'Private Quiz',
      'Security'
    );

    const response = await request(app)
      .get(`/api/analytics/instructor/quizzes/${quiz._id}`)
      .set(bearer(otherInstructor.token));

    expect(response.status).toBe(403);
  });

  test('blocks students from accessing instructor analytics', async () => {
    const instructor = await createUser('instructor');
    const student = await createUser('student');

    const { quiz } = await createPublishedQuiz(
      instructor.token,
      'Instructor Quiz',
      'Networks'
    );

    const response = await request(app)
      .get(`/api/analytics/instructor/quizzes/${quiz._id}`)
      .set(bearer(student.token));

    expect(response.status).toBe(403);
  });

  test('requires authentication for instructor analytics', async () => {
    const response = await request(app)
      .get('/api/analytics/instructor/quizzes');

    expect(response.status).toBe(401);
  });

  test('lists only quizzes belonging to the logged-in instructor', async () => {
    const instructor1 = await createUser('instructor');
    const instructor2 = await createUser('instructor');

    await createPublishedQuiz(
      instructor1.token,
      'My Quiz',
      'Arrays'
    );

    await createPublishedQuiz(
      instructor2.token,
      'Other Instructor Quiz',
      'Networks'
    );

    const response = await request(app)
      .get('/api/analytics/instructor/quizzes')
      .set(bearer(instructor1.token));

    expect(response.status).toBe(200);
    expect(response.body.quizzes).toHaveLength(1);
    expect(response.body.quizzes[0].title).toBe('My Quiz');
  });
});
