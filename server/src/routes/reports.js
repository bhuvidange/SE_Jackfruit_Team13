const express = require('express');
const Report = require('../models/Report');
const Material = require('../models/Material');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
const ID_RE = /^[0-9a-fA-F]{24}$/;
const STATUSES = ['open', 'removed', 'dismissed'];
const MODELS = { material: Material, question: Question };

router.use(authenticate);

const isId = (v) => typeof v === 'string' && ID_RE.test(v);

async function findActiveTarget(targetType, targetId) {
  const target = await MODELS[targetType].findOne({ _id: targetId, status: 'active' });
  if (!target) throw new HttpError(404, `${targetType === 'material' ? 'Material' : 'Question'} not found`);
  return target;
}

// CSMQP-F-051: any logged-in user can report a material or question
router.post('/', async (req, res) => {
  const { targetType, targetId, reason } = req.body || {};
  const errors = [];
  if (!Object.hasOwn(MODELS, targetType)) errors.push('Target type must be material or question');
  if (!isId(targetId)) errors.push('Target id is invalid');
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
    errors.push('Reason is required (max 500 characters)');
  }
  if (errors.length) throw new HttpError(400, errors.join('. '), { errors });

  await findActiveTarget(targetType, targetId);
  const duplicate = await Report.exists({ targetType, target: targetId, reporter: req.user._id, status: 'open' });
  if (duplicate) throw new HttpError(409, 'You have already reported this item');

  const report = await Report.create({ targetType, target: targetId, reporter: req.user._id, reason: reason.trim() });
  res.status(201).json({ report });
});

/** Short, display-ready description of what was reported. */
function describe(targetType, doc) {
  if (!doc) return null;
  return targetType === 'material'
    ? { title: doc.title, subject: doc.subject }
    : { text: doc.text.length > 120 ? `${doc.text.slice(0, 117)}...` : doc.text, subject: doc.subject };
}

router.get('/', authorize('admin'), async (req, res) => {
  const { status = 'open' } = req.query;
  if (typeof status !== 'string' || !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const reports = await Report.find({ status }).sort({ createdAt: -1 }).limit(200);

  const idsOf = (type) => reports.filter((r) => r.targetType === type).map((r) => r.target);
  const [materials, questions, users] = await Promise.all([
    Material.find({ _id: { $in: idsOf('material') } }),
    Question.find({ _id: { $in: idsOf('question') } }),
    User.find({ _id: { $in: reports.map((r) => r.reporter) } }),
  ]);
  const byId = (docs) => new Map(docs.map((d) => [String(d._id), d]));
  const targets = { material: byId(materials), question: byId(questions) };
  const reporters = byId(users);

  res.json({
    reports: reports.map((r) => ({
      ...r.toJSON(),
      reporterName: reporters.get(String(r.reporter))?.name ?? 'Unknown user',
      targetSummary: describe(r.targetType, targets[r.targetType].get(String(r.target))),
    })),
  });
});

async function findOpenReport(id) {
  const report = isId(id) ? await Report.findById(id) : null;
  if (!report) throw new HttpError(404, 'Report not found');
  if (report.status !== 'open') throw new HttpError(409, 'This report has already been resolved');
  return report;
}

router.patch('/:id/remove', authorize('admin'), async (req, res) => {
  const report = await findOpenReport(req.params.id);
  const { targetType, target } = report;

  if (targetType === 'question' && (await Quiz.exists({ questions: target, published: true }))) {
    throw new HttpError(409, 'This question is used in a published quiz and cannot be removed');
  }
  await MODELS[targetType].updateOne({ _id: target }, { status: 'removed' });

  const resolution = { status: 'removed', resolvedBy: req.user._id, resolvedAt: new Date() };
  await Report.updateMany({ targetType, target, status: 'open' }, resolution);
  res.json({ report: await Report.findById(report._id) });
});

router.patch('/:id/dismiss', authorize('admin'), async (req, res) => {
  const report = await findOpenReport(req.params.id);
  report.set({ status: 'dismissed', resolvedBy: req.user._id, resolvedAt: new Date() });
  await report.save();
  res.json({ report });
});

module.exports = router;
