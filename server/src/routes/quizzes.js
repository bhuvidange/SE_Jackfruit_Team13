const express = require('express');
const config = require('../config');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
const ID_RE = /^[0-9a-fA-F]{24}$/;

/** Question as shown to a student: never includes the answer. */
const publicQuestion = (q) => ({ id: q.id, type: q.type, text: q.text, options: q.options });
const instructorQuestion = (q) => ({ ...publicQuestion(q), correctAnswer: q.correctAnswer, subject: q.subject, topic: q.topic, difficulty: q.difficulty });

/** Loads the quiz's questions in quiz order. */
async function loadQuestions(quiz) {
  const found = await Question.find({ _id: { $in: quiz.questions } });
  const byId = new Map(found.map((q) => [String(q._id), q]));
  return quiz.questions.map((id) => byId.get(String(id))).filter(Boolean);
}

const summary = (quiz) => ({
  id: quiz.id,
  title: quiz.title,
  timeLimitMinutes: quiz.timeLimitMinutes,
  published: quiz.published,
  publishedAt: quiz.publishedAt,
  questionCount: quiz.questions.length,
  createdAt: quiz.createdAt,
});

async function findQuiz(id) {
  const quiz = await Quiz.findById(id);
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  return quiz;
}

function ownQuiz(quiz, user) {
  if (String(quiz.instructor) !== String(user._id)) throw new HttpError(403, 'Only the instructor who created this quiz can do that');
}

async function findPublished(id) {
  const quiz = await Quiz.findById(id);
  if (!quiz || !quiz.published) throw new HttpError(404, 'Quiz not found');
  return quiz;
}

function attemptView(attempt, quiz, student) {
  return {
    id: attempt.id,
    quizId: String(attempt.quiz),
    quizTitle: quiz && quiz.title,
    student: student ? { id: student.id, name: student.name } : undefined,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    total: attempt.total,
    percentage: attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0,
    results: attempt.graded.map((g) => ({
      questionId: String(g.question),
      text: g.text,
      options: g.options,
      selected: g.selected,
      correctAnswer: g.correctAnswer,
      correct: g.correct,
    })),
  };
}

router.use(authenticate);

// CSMQP-F-030 / F-031: create a quiz from bank questions with a time limit
router.post('/', authorize('instructor'), async (req, res) => {
  const { title, questionIds, timeLimitMinutes } = req.body || {};
  const errors = [];
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) errors.push('Title is required (max 150 characters)');
  if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 300) {
    errors.push('Time limit must be a whole number of minutes between 1 and 300');
  }
  if (!Array.isArray(questionIds) || questionIds.length < 1 || questionIds.length > 100) {
    errors.push('Select between 1 and 100 questions');
  } else if (!questionIds.every((id) => typeof id === 'string' && ID_RE.test(id))) {
    errors.push('Question ids are invalid');
  } else if (new Set(questionIds).size !== questionIds.length) {
    errors.push('A question can only be selected once');
  }
  if (errors.length) throw new HttpError(400, errors.join('. '), { errors });

  const active = await Question.countDocuments({ _id: { $in: questionIds }, status: 'active' });
  if (active !== questionIds.length) throw new HttpError(400, 'Some selected questions do not exist in the question bank');

  const quiz = await Quiz.create({ instructor: req.user._id, title: title.trim(), questions: questionIds, timeLimitMinutes });
  res.status(201).json({ quiz: summary(quiz) });
});

// Instructors see their own quizzes; students see published quizzes with their attempt status.
router.get('/', authorize('student', 'instructor'), async (req, res) => {
  if (req.user.role === 'instructor') {
    const quizzes = await Quiz.find({ instructor: req.user._id }).sort({ createdAt: -1 });
    return res.json({ quizzes: quizzes.map(summary) });
  }
  const quizzes = await Quiz.find({ published: true }).sort({ publishedAt: -1 });
  const attempts = await QuizAttempt.find({ student: req.user._id, quiz: { $in: quizzes.map((q) => q._id) } });
  const byQuiz = new Map(attempts.map((a) => [String(a.quiz), a]));
  res.json({
    quizzes: quizzes.map((q) => {
      const a = byQuiz.get(String(q._id));
      return { ...summary(q), attempt: a ? { id: a.id, status: a.status, score: a.score, total: a.total } : null };
    }),
  });
});

// Result of one attempt (CSMQP-F-035): the student who took it, or the quiz's instructor.
router.get('/attempts/:attemptId', authorize('student', 'instructor'), async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.attemptId);
  if (!attempt) throw new HttpError(404, 'Attempt not found');
  const quiz = await Quiz.findById(attempt.quiz);
  const isOwnerStudent = String(attempt.student) === String(req.user._id);
  const isQuizInstructor = quiz && String(quiz.instructor) === String(req.user._id);
  if (!isOwnerStudent && !isQuizInstructor) throw new HttpError(403, 'You cannot view this attempt');
  if (attempt.status === 'in_progress') throw new HttpError(409, 'This attempt has not been submitted yet');
  res.json({ attempt: attemptView(attempt, quiz, isQuizInstructor ? await User.findById(attempt.student) : undefined) });
});

router.get('/:id', authorize('student', 'instructor'), async (req, res) => {
  if (req.user.role === 'instructor') {
    const quiz = await findQuiz(req.params.id);
    ownQuiz(quiz, req.user);
    return res.json({ quiz: { ...summary(quiz), questions: (await loadQuestions(quiz)).map(instructorQuestion) } });
  }
  res.json({ quiz: summary(await findPublished(req.params.id)) });
});

// CSMQP-F-032
router.post('/:id/publish', authorize('instructor'), async (req, res) => {
  const quiz = await findQuiz(req.params.id);
  ownQuiz(quiz, req.user);
  if (quiz.published) throw new HttpError(409, 'Quiz is already published');
  const active = await Question.countDocuments({ _id: { $in: quiz.questions }, status: 'active' });
  if (active !== quiz.questions.length) throw new HttpError(409, 'Some questions in this quiz were deleted from the bank');
  quiz.published = true;
  quiz.publishedAt = new Date();
  await quiz.save();
  res.json({ quiz: summary(quiz) });
});

// Start (or resume) the single attempt a student has per quiz; the server fixes the deadline (CSMQP-F-031).
router.post('/:id/start', authorize('student'), async (req, res) => {
  const quiz = await findPublished(req.params.id);
  let attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
  const now = new Date();

  if (attempt && attempt.status === 'submitted') {
    throw new HttpError(409, 'You have already submitted this quiz', { attemptId: attempt.id });
  }
  if (attempt && attempt.status === 'in_progress' && now > attempt.expiresAt) {
    attempt.status = 'expired';
    await attempt.save();
  }
  if (attempt && attempt.status === 'expired') {
    throw new HttpError(409, 'Your time for this quiz has run out', { attemptId: attempt.id });
  }
  if (!attempt) {
    try {
      attempt = await QuizAttempt.create({
        quiz: quiz._id,
        student: req.user._id,
        startedAt: now,
        expiresAt: new Date(now.getTime() + quiz.timeLimitMinutes * 60 * 1000),
      });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, 'An attempt is already in progress');
      throw err;
    }
  }

  const questions = await loadQuestions(quiz);
  res.json({
    attempt: { id: attempt.id, status: attempt.status, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt },
    serverTime: new Date().toISOString(),
    quiz: { id: quiz.id, title: quiz.title, timeLimitMinutes: quiz.timeLimitMinutes, questions: questions.map(publicQuestion) },
  });
});

// CSMQP-F-033 / F-034: submit, enforce the time limit, grade automatically
router.post('/:id/submit', authorize('student'), async (req, res) => {
  const quiz = await findPublished(req.params.id);
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) throw new HttpError(400, 'answers must be an array of { questionId, selected }');

  const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
  if (!attempt) throw new HttpError(400, 'Start the quiz before submitting');
  if (attempt.status === 'submitted') throw new HttpError(409, 'You have already submitted this quiz', { attemptId: attempt.id });
  if (attempt.status === 'expired') throw new HttpError(400, 'Submission rejected: the time limit has passed');

  const now = new Date();
  if (now.getTime() > attempt.expiresAt.getTime() + config.submitGraceSeconds * 1000) {
    attempt.status = 'expired';
    await attempt.save();
    throw new HttpError(400, 'Submission rejected: the time limit has passed');
  }

  const questions = await loadQuestions(quiz);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const chosen = new Map();
  for (const a of answers) {
    if (!a || typeof a.questionId !== 'string' || !byId.has(a.questionId)) throw new HttpError(400, 'Answer refers to a question that is not in this quiz');
    if (chosen.has(a.questionId)) throw new HttpError(400, 'Each question can only be answered once');
    const q = byId.get(a.questionId);
    if (a.selected !== null && a.selected !== undefined) {
      if (!Number.isInteger(a.selected) || a.selected < 0 || a.selected >= q.options.length) {
        throw new HttpError(400, 'Selected option is out of range');
      }
    }
    chosen.set(a.questionId, a.selected ?? null);
  }

  const graded = questions.map((q) => {
    const selected = chosen.has(q.id) ? chosen.get(q.id) : null;
    return { question: q._id, text: q.text, options: q.options, selected, correctAnswer: q.correctAnswer, correct: selected === q.correctAnswer };
  });
  const score = graded.filter((g) => g.correct).length;

  // Guarded update so a double submit cannot grade twice.
  const updated = await QuizAttempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    { status: 'submitted', submittedAt: now, score, total: graded.length, graded },
    { returnDocument: 'after' }
  );
  if (!updated) throw new HttpError(409, 'You have already submitted this quiz');
  res.json({ attempt: attemptView(updated, quiz) });
});

module.exports = router;
