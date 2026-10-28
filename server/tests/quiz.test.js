const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer } = require('./helpers');
const Question = require('../src/models/Question');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

const q = (n, correctAnswer = 0) => ({
  type: 'mcq',
  text: `Question ${n}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer,
  subject: 'General',
  topic: 'Mixed',
  difficulty: 'easy',
});

/** Creates an instructor with `n` questions (correct answers cycle 0,1,2,3) and returns ids. */
async function setup(n = 4) {
  const instructor = await createUser('instructor');
  const ids = [];
  for (let i = 0; i < n; i++) {
    const res = await request(app).post('/api/questions').set(bearer(instructor.token)).send(q(i + 1, i % 4));
    ids.push(res.body.question.id);
  }
  return { instructor, ids };
}

const createQuiz = (token, body) => request(app).post('/api/quizzes').set(bearer(token)).send(body);
const publish = (token, id) => request(app).post(`/api/quizzes/${id}/publish`).set(bearer(token));
const start = (token, id) => request(app).post(`/api/quizzes/${id}/start`).set(bearer(token));
const submit = (token, id, answers) => request(app).post(`/api/quizzes/${id}/submit`).set(bearer(token)).send({ answers });

async function publishedQuiz(n = 4, timeLimitMinutes = 10) {
  const { instructor, ids } = await setup(n);
  const created = await createQuiz(instructor.token, { title: 'Quiz', questionIds: ids, timeLimitMinutes });
  await publish(instructor.token, created.body.quiz.id);
  return { instructor, ids, quizId: created.body.quiz.id };
}

describe('TC-Quiz-01 create a quiz from selected question IDs (CSMQP-F-030)', () => {
  test('quiz references the selected questions in order', async () => {
    const { instructor, ids } = await setup(3);
    const res = await createQuiz(instructor.token, { title: ' Midterm ', questionIds: [ids[2], ids[0]], timeLimitMinutes: 20 });
    expect(res.status).toBe(201);
    expect(res.body.quiz).toMatchObject({ title: 'Midterm', questionCount: 2, timeLimitMinutes: 20, published: false });
    const stored = await Quiz.findById(res.body.quiz.id);
    expect(stored.questions.map(String)).toEqual([ids[2], ids[0]]);
    const detail = await request(app).get(`/api/quizzes/${res.body.quiz.id}`).set(bearer(instructor.token));
    expect(detail.body.quiz.questions.map((x) => x.id)).toEqual([ids[2], ids[0]]);
    expect(detail.body.quiz.questions[0].correctAnswer).toBeDefined();
  });

  test.each([
    ['empty selection', { questionIds: [] }],
    ['no questionIds', { questionIds: undefined }],
    ['malformed id', { questionIds: ['nope'] }],
    ['unknown id', { questionIds: ['64b000000000000000000001'] }],
    ['operator object as id', { questionIds: [{ $gt: '' }] }],
    ['blank title', { title: '   ' }],
  ])('rejects %s', async (_, patch) => {
    const { instructor, ids } = await setup(1);
    const res = await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5, ...patch });
    expect(res.status).toBe(400);
    expect(await Quiz.countDocuments()).toBe(0);
  });

  test('duplicate question ids and deleted questions are rejected', async () => {
    const { instructor, ids } = await setup(2);
    expect((await createQuiz(instructor.token, { title: 'T', questionIds: [ids[0], ids[0]], timeLimitMinutes: 5 })).status).toBe(400);
    await Question.updateOne({ _id: ids[1] }, { status: 'removed' });
    expect((await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5 })).status).toBe(400);
  });

  test('a student cannot create a quiz (403)', async () => {
    const { ids } = await setup(1);
    const student = await createUser('student');
    expect((await createQuiz(student.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5 })).status).toBe(403);
  });
});

describe('TC-Quiz-02 time limit is configured and enforced (CSMQP-F-031)', () => {
  test.each([
    [0, 400],
    [1, 201],
    [300, 201],
    [301, 400],
    [1.5, 400],
    ['10', 400],
    [-5, 400],
  ])('time limit %p -> %i', async (timeLimitMinutes, status) => {
    const { instructor, ids } = await setup(1);
    expect((await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes })).status).toBe(status);
  });

  test('the attempt deadline equals start + configured limit', async () => {
    const { quizId } = await publishedQuiz(2, 15);
    const student = await createUser('student');
    const res = await start(student.token, quizId);
    expect(res.status).toBe(200);
    const { startedAt, expiresAt } = res.body.attempt;
    expect(new Date(expiresAt) - new Date(startedAt)).toBe(15 * 60 * 1000);
    expect(res.body.quiz.timeLimitMinutes).toBe(15);
  });

  test('starting again resumes the same attempt with the same deadline', async () => {
    const { quizId } = await publishedQuiz(2);
    const student = await createUser('student');
    const first = await start(student.token, quizId);
    const second = await start(student.token, quizId);
    expect(second.body.attempt.id).toBe(first.body.attempt.id);
    expect(second.body.attempt.expiresAt).toBe(first.body.attempt.expiresAt);
    expect(await QuizAttempt.countDocuments()).toBe(1);
  });

  test('questions sent to the student never include correct answers', async () => {
    const { quizId } = await publishedQuiz(2);
    const student = await createUser('student');
    const res = await start(student.token, quizId);
    expect(JSON.stringify(res.body)).not.toMatch(/correctAnswer/);
    expect(res.body.quiz.questions).toHaveLength(2);
  });
});

describe('TC-Quiz-03 publish a quiz (CSMQP-F-032)', () => {
  test('unpublished quizzes are hidden from students; published ones appear', async () => {
    const { instructor, ids } = await setup(2);
    const student = await createUser('student');
    const created = await createQuiz(instructor.token, { title: 'Hidden', questionIds: ids, timeLimitMinutes: 5 });
    const id = created.body.quiz.id;

    expect((await request(app).get('/api/quizzes').set(bearer(student.token))).body.quizzes).toHaveLength(0);
    expect((await start(student.token, id)).status).toBe(404);
    expect((await request(app).get(`/api/quizzes/${id}`).set(bearer(student.token))).status).toBe(404);

    const pub = await publish(instructor.token, id);
    expect(pub.status).toBe(200);
    expect(pub.body.quiz.published).toBe(true);
    const list = await request(app).get('/api/quizzes').set(bearer(student.token));
    expect(list.body.quizzes).toHaveLength(1);
    expect(list.body.quizzes[0]).toMatchObject({ id, title: 'Hidden', attempt: null });
  });

  test('instructor lists own quizzes including drafts', async () => {
    const { instructor, ids } = await setup(1);
    await createQuiz(instructor.token, { title: 'Draft', questionIds: ids, timeLimitMinutes: 5 });
    const other = await createUser('instructor');
    expect((await request(app).get('/api/quizzes').set(bearer(instructor.token))).body.quizzes).toHaveLength(1);
    expect((await request(app).get('/api/quizzes').set(bearer(other.token))).body.quizzes).toHaveLength(0);
  });

  test('only the owner can publish; publishing twice conflicts', async () => {
    const { instructor, ids } = await setup(1);
    const other = await createUser('instructor');
    const student = await createUser('student');
    const { body } = await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5 });
    expect((await publish(other.token, body.quiz.id)).status).toBe(403);
    expect((await publish(student.token, body.quiz.id)).status).toBe(403);
    expect((await publish(instructor.token, body.quiz.id)).status).toBe(200);
    expect((await publish(instructor.token, body.quiz.id)).status).toBe(409);
  });

  test('publishing is refused if a question was deleted meanwhile', async () => {
    const { instructor, ids } = await setup(2);
    const { body } = await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5 });
    await request(app).delete(`/api/questions/${ids[0]}`).set(bearer(instructor.token));
    expect((await publish(instructor.token, body.quiz.id)).status).toBe(409);
  });

  test('another instructor cannot open a quiz they do not own', async () => {
    const { instructor, ids } = await setup(1);
    const other = await createUser('instructor');
    const { body } = await createQuiz(instructor.token, { title: 'T', questionIds: ids, timeLimitMinutes: 5 });
    expect((await request(app).get(`/api/quizzes/${body.quiz.id}`).set(bearer(other.token))).status).toBe(403);
  });
});

describe('TC-Quiz-04 attempt and submit within/after the time limit (CSMQP-F-033)', () => {
  test('valid submission within the limit succeeds', async () => {
    const { quizId, ids } = await publishedQuiz(2);
    const student = await createUser('student');
    await start(student.token, quizId);
    const res = await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }]);
    expect(res.status).toBe(200);
    expect(res.body.attempt.status).toBe('submitted');
  });

  test('submission after the limit (beyond grace) is rejected and the attempt expires', async () => {
    const { quizId, ids } = await publishedQuiz(2);
    const student = await createUser('student');
    const started = await start(student.token, quizId);
    await QuizAttempt.updateOne({ _id: started.body.attempt.id }, { expiresAt: new Date(Date.now() - 6000) });
    const res = await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/time limit/i);
    const stored = await QuizAttempt.findById(started.body.attempt.id);
    expect(stored.status).toBe('expired');
    expect(stored.score).toBe(0);
    expect((await start(student.token, quizId)).status).toBe(409);
  });

  test('submission 1 second after the deadline is inside the network grace window and accepted', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    const started = await start(student.token, quizId);
    await QuizAttempt.updateOne({ _id: started.body.attempt.id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }])).status).toBe(200);
  });

  test('cannot submit without starting, or twice', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    expect((await submit(student.token, quizId, [])).status).toBe(400);
    await start(student.token, quizId);
    expect((await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }])).status).toBe(200);
    expect((await submit(student.token, quizId, [{ questionId: ids[0], selected: 1 }])).status).toBe(409);
    expect((await start(student.token, quizId)).status).toBe(409);
  });

  test.each([
    ['answers not an array', 'oops'],
    ['unknown question', [{ questionId: '64b000000000000000000001', selected: 0 }]],
    ['option out of range', [{ questionId: 'FIRST', selected: 4 }]],
    ['negative option', [{ questionId: 'FIRST', selected: -1 }]],
    ['non-integer option', [{ questionId: 'FIRST', selected: '0' }]],
  ])('invalid payload: %s -> 400', async (_, answers) => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    await start(student.token, quizId);
    const body = Array.isArray(answers) ? answers.map((a) => ({ ...a, questionId: a.questionId === 'FIRST' ? ids[0] : a.questionId })) : answers;
    expect((await submit(student.token, quizId, body)).status).toBe(400);
    expect((await QuizAttempt.findOne()).status).toBe('in_progress');
  });

  test('instructors cannot attempt quizzes (403)', async () => {
    const { instructor, quizId } = await publishedQuiz(1);
    expect((await start(instructor.token, quizId)).status).toBe(403);
  });
});

describe('TC-Quiz-05 automatic scoring (CSMQP-F-034)', () => {
  // correct answers for the 4 generated questions are 0,1,2,3
  const run = async (selections) => {
    const { quizId, ids } = await publishedQuiz(4);
    const student = await createUser('student');
    await start(student.token, quizId);
    const answers = selections.map((selected, i) => ({ questionId: ids[i], selected })).filter((a) => a.selected !== undefined);
    return (await submit(student.token, quizId, answers)).body.attempt;
  };

  test('all correct -> 4/4', async () => {
    const a = await run([0, 1, 2, 3]);
    expect(a).toMatchObject({ score: 4, total: 4, percentage: 100 });
  });

  test('score equals the count of correct answers', async () => {
    expect(await run([0, 1, 0, 0])).toMatchObject({ score: 2, total: 4, percentage: 50 });
  });

  test('all wrong -> 0', async () => {
    expect(await run([3, 2, 1, 0])).toMatchObject({ score: 0, percentage: 0 });
  });

  test('unanswered questions (omitted or null) score zero', async () => {
    expect(await run([0, undefined, null, undefined])).toMatchObject({ score: 1, total: 4 });
    expect(await run([])).toMatchObject({ score: 0, total: 4 });
  });

  test('duplicate answers for one question are rejected', async () => {
    const { quizId, ids } = await publishedQuiz(2);
    const student = await createUser('student');
    await start(student.token, quizId);
    const res = await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }, { questionId: ids[0], selected: 1 }]);
    expect(res.status).toBe(400);
  });

  test('grading completes within 1 second (CSMQP-NF-003)', async () => {
    const { quizId, ids } = await publishedQuiz(50);
    const student = await createUser('student');
    await start(student.token, quizId);
    const t0 = Date.now();
    const res = await submit(student.token, quizId, ids.map((id) => ({ questionId: id, selected: 0 })));
    expect(res.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('TC-Quiz-06 result shows per-question correctness (CSMQP-F-035)', () => {
  test('result lists each question with the chosen and correct option', async () => {
    const { instructor, quizId, ids } = await publishedQuiz(3);
    const student = await createUser('student');
    await start(student.token, quizId);
    const sub = await submit(student.token, quizId, [
      { questionId: ids[0], selected: 0 }, // correct
      { questionId: ids[1], selected: 3 }, // wrong (correct is 1)
    ]);
    const res = await request(app).get(`/api/quizzes/attempts/${sub.body.attempt.id}`).set(bearer(student.token));
    expect(res.status).toBe(200);
    const { attempt } = res.body;
    expect(attempt).toMatchObject({ score: 1, total: 3, quizTitle: 'Quiz' });
    expect(attempt.results.map((r) => r.correct)).toEqual([true, false, false]);
    expect(attempt.results[1]).toMatchObject({ selected: 3, correctAnswer: 1, text: 'Question 2' });
    expect(attempt.results[2].selected).toBeNull();

    const asInstructor = await request(app).get(`/api/quizzes/attempts/${sub.body.attempt.id}`).set(bearer(instructor.token));
    expect(asInstructor.status).toBe(200);
    expect(asInstructor.body.attempt.student.id).toBe(student.user.id);
  });

  test('the result is a snapshot: later edits to the question do not change it', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    await start(student.token, quizId);
    const sub = await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }]);
    await Question.updateOne({ _id: ids[0] }, { text: 'Rewritten', correctAnswer: 3 });
    const res = await request(app).get(`/api/quizzes/attempts/${sub.body.attempt.id}`).set(bearer(student.token));
    expect(res.body.attempt.results[0]).toMatchObject({ text: 'Question 1', correct: true, correctAnswer: 0 });
  });

  test('other students and other instructors cannot view the result; in-progress has none', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    const otherStudent = await createUser('student');
    const otherInstructor = await createUser('instructor');
    const started = await start(student.token, quizId);
    const get = (t) => request(app).get(`/api/quizzes/attempts/${started.body.attempt.id}`).set(bearer(t));
    expect((await get(student.token)).status).toBe(409);
    await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }]);
    expect((await get(student.token)).status).toBe(200);
    expect((await get(otherStudent.token)).status).toBe(403);
    expect((await get(otherInstructor.token)).status).toBe(403);
    expect((await request(app).get('/api/quizzes/attempts/64b000000000000000000001').set(bearer(student.token))).status).toBe(404);
  });

  test('student list shows attempt status and score', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    await start(student.token, quizId);
    await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }]);
    const list = await request(app).get('/api/quizzes').set(bearer(student.token));
    expect(list.body.quizzes[0].attempt).toMatchObject({ status: 'submitted', score: 1, total: 1 });
  });
});

describe('TC-Sec-03 students cannot modify quizzes/questions/grades (CSMQP-SR-003)', () => {
  test('student writes to quiz endpoints return 403 and data is unchanged', async () => {
    const { instructor, quizId, ids } = await publishedQuiz(2);
    const student = await createUser('student');
    expect((await createQuiz(student.token, { title: 'X', questionIds: ids, timeLimitMinutes: 5 })).status).toBe(403);
    expect((await publish(student.token, quizId)).status).toBe(403);
    expect((await request(app).put(`/api/questions/${ids[0]}`).set(bearer(student.token)).send({ ...q(1), text: 'Hacked' })).status).toBe(403);
    expect((await request(app).delete(`/api/questions/${ids[0]}`).set(bearer(student.token))).status).toBe(403);
    expect(await Quiz.countDocuments()).toBe(1);
    expect((await Question.findById(ids[0])).text).toBe('Question 1');
    expect(instructor).toBeTruthy();
  });

  test('a graded attempt cannot be changed through the API', async () => {
    const { quizId, ids } = await publishedQuiz(1);
    const student = await createUser('student');
    await start(student.token, quizId);
    const sub = await submit(student.token, quizId, [{ questionId: ids[0], selected: 3 }]);
    const id = sub.body.attempt.id;
    expect((await request(app).put(`/api/quizzes/attempts/${id}`).set(bearer(student.token)).send({ score: 99 })).status).toBe(404);
    expect((await request(app).patch(`/api/quizzes/attempts/${id}`).set(bearer(student.token)).send({ score: 99 })).status).toBe(404);
    expect((await submit(student.token, quizId, [{ questionId: ids[0], selected: 0 }])).status).toBe(409);
    expect((await QuizAttempt.findById(id)).score).toBe(0);
  });
});

describe('TC-QB-04 deletion blocked when the question is in a published quiz (CSMQP-F-023)', () => {
  test('delete returns 409 for published quizzes but works for drafts', async () => {
    const { instructor, ids } = await setup(2);
    const { body } = await createQuiz(instructor.token, { title: 'T', questionIds: [ids[0]], timeLimitMinutes: 5 });
    // still a draft -> deletable (ids[1] is unused anyway; check ids[0] after publishing)
    await publish(instructor.token, body.quiz.id);
    const blocked = await request(app).delete(`/api/questions/${ids[0]}`).set(bearer(instructor.token));
    expect(blocked.status).toBe(409);
    expect((await Question.findById(ids[0])).status).toBe('active');
    expect((await request(app).delete(`/api/questions/${ids[1]}`).set(bearer(instructor.token))).status).toBe(200);
  });
});
