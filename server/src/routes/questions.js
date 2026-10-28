const express = require('express');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const HttpError = require('../utils/httpError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
const TYPES = ['mcq', 'tf'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

/** Validates a question payload (CSMQP-F-021) and returns the cleaned fields or throws a 400. */
function parseQuestion(body = {}) {
  const errors = [];
  const { type, text, subject, topic, difficulty, correctAnswer } = body;
  let { options } = body;

  if (!TYPES.includes(type)) errors.push('Type must be mcq or tf');
  if (!isText(text, 1000)) errors.push('Question text is required (max 1000 characters)');
  if (!isText(subject, 100)) errors.push('Subject is required');
  if (!isText(topic, 100)) errors.push('Topic is required');
  if (!DIFFICULTIES.includes(difficulty)) errors.push('Difficulty must be easy, medium or hard');

  if (type === 'tf' && options === undefined) options = ['True', 'False'];
  if (TYPES.includes(type)) {
    const required = type === 'mcq' ? 4 : 2;
    if (!Array.isArray(options) || options.length !== required) {
      errors.push(type === 'mcq' ? 'A multiple choice question needs exactly 4 options' : 'A True/False question needs exactly 2 options');
    } else if (!options.every((o) => isText(o, 300))) {
      errors.push('Every option must be a non-empty text');
    } else if (new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length) {
      errors.push('Options must be different from each other');
    } else if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      errors.push('Exactly one correct answer (option index) is required');
    }
  }
  if (errors.length) throw new HttpError(400, errors.join('. '), { errors });

  return {
    type,
    text: text.trim(),
    options: options.map((o) => o.trim()),
    correctAnswer,
    subject: subject.trim(),
    topic: topic.trim(),
    difficulty,
  };
}

async function findActive(id) {
  const question = await Question.findOne({ _id: id, status: 'active' });
  if (!question) throw new HttpError(404, 'Question not found');
  return question;
}

function assertOwner(question, user) {
  if (String(question.owner) !== String(user._id)) {
    throw new HttpError(403, 'Only the instructor who created a question can change it');
  }
}

router.use(authenticate);

// CSMQP-F-020 / F-021
router.post('/', authorize('instructor'), async (req, res) => {
  const question = await Question.create({ ...parseQuestion(req.body), owner: req.user._id });
  res.status(201).json({ question });
});

// CSMQP-F-022: list and filter by subject / topic / difficulty (plus type and free text)
router.get('/', authorize('instructor', 'admin'), async (req, res) => {
  const filter = { status: 'active' };
  for (const key of ['subject', 'topic', 'difficulty', 'type']) {
    const value = req.query[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string') throw new HttpError(400, `Invalid ${key} filter`);
    filter[key] = new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
  }
  if (req.query.q !== undefined && req.query.q !== '') {
    if (typeof req.query.q !== 'string') throw new HttpError(400, 'Invalid search text');
    filter.text = new RegExp(escapeRegex(req.query.q.trim()), 'i');
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const questions = await Question.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ questions });
});

router.get('/:id', authorize('instructor', 'admin'), async (req, res) => {
  res.json({ question: await findActive(req.params.id) });
});

// CSMQP-F-023: edit
router.put('/:id', authorize('instructor'), async (req, res) => {
  const question = await findActive(req.params.id);
  assertOwner(question, req.user);
  question.set(parseQuestion(req.body));
  await question.save();
  res.json({ question });
});

// CSMQP-F-023: delete (soft delete so existing quizzes keep a valid reference)
router.delete('/:id', authorize('instructor'), async (req, res) => {
  const question = await findActive(req.params.id);
  assertOwner(question, req.user);
  if (await Quiz.exists({ questions: question._id, published: true })) {
    throw new HttpError(409, 'This question is used in a published quiz and cannot be deleted');
  }
  question.status = 'removed';
  await question.save();
  res.json({ message: 'Question deleted' });
});

module.exports = router;
