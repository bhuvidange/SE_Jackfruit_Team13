const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const Material = require('../models/Material');
const HttpError = require('../utils/httpError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { clean } = require('../middleware/sanitize');

const router = express.Router();

// CSMQP-F-010: supported formats. The leading bytes of the file must match its extension.
const FORMATS = {
  '.pdf': { format: 'pdf', mimes: ['application/pdf'], magic: [Buffer.from('%PDF')] },
  '.docx': {
    format: 'docx',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magic: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  },
  '.pptx': {
    format: 'pptx',
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    magic: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  },
  '.jpg': { format: 'jpg', mimes: ['image/jpeg'], magic: [Buffer.from([0xff, 0xd8, 0xff])] },
  '.jpeg': { format: 'jpg', mimes: ['image/jpeg'], magic: [Buffer.from([0xff, 0xd8, 0xff])] },
};
const UNSUPPORTED = 'Unsupported file type. Allowed formats: PDF, DOCX, PPTX, JPG';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(config.uploadDir, { recursive: true });
      cb(null, config.uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 }, // CSMQP-F-011: 15 MB
  fileFilter: (req, file, cb) => {
    const spec = FORMATS[path.extname(file.originalname).toLowerCase()];
    if (!spec || !spec.mimes.includes(file.mimetype)) return cb(new HttpError(400, UNSUPPORTED));
    cb(null, true);
  },
});

function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) {
      // multipart fields are parsed after the global sanitizer ran, so sanitize them here too
      req.body = clean(req.body || {});
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, `File is too large. The maximum size is ${config.maxUploadBytes / (1024 * 1024)} MB`));
    }
    if (err instanceof multer.MulterError) return next(new HttpError(400, err.message));
    next(err);
  });
}

const discard = (file) => file && fs.promises.unlink(file.path).catch(() => {});
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const text = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

async function hasExpectedSignature(file, spec) {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buf = Buffer.alloc(4);
    await handle.read(buf, 0, 4, 0);
    return spec.magic.some((m) => buf.subarray(0, m.length).equals(m));
  } finally {
    await handle.close();
  }
}

router.use(authenticate);

// CSMQP-F-010 / F-011 / F-012
router.post('/', authorize('instructor'), receiveFile, async (req, res) => {
  const { file } = req;
  try {
    if (!file) throw new HttpError(400, 'A file is required (form field "file")');
    const title = text(req.body.title, 200);
    const subject = text(req.body.subject, 100);
    const topic = text(req.body.topic, 100);
    const errors = [];
    if (!title) errors.push('Title is required');
    if (!subject) errors.push('Subject is required');
    if (!topic) errors.push('Topic is required');
    const description = req.body.description === undefined ? '' : text(req.body.description, 1000);
    if (description === null) errors.push('Description must be at most 1000 characters');
    if (errors.length) throw new HttpError(400, errors.join('. '), { errors });

    const spec = FORMATS[path.extname(file.originalname).toLowerCase()];
    if (!(await hasExpectedSignature(file, spec))) throw new HttpError(400, 'File content does not match its extension');

    const material = await Material.create({
      owner: req.user._id,
      title,
      subject,
      topic,
      description,
      originalName: path.basename(file.originalname),
      format: spec.format,
      mimeType: file.mimetype,
      size: file.size,
      storedName: file.filename,
    });
    res.status(201).json({ material });
  } catch (err) {
    await discard(file);
    throw err;
  }
});

// CSMQP-F-013: search by name / keyword (title, subject, topic, description, file name)
router.get('/', async (req, res) => {
  const { query, subject, topic } = req.query;
  const filter = { status: 'active' };
  for (const [key, value] of Object.entries({ query, subject, topic })) {
    if (value !== undefined && typeof value !== 'string') throw new HttpError(400, `Invalid ${key}`);
  }
  if (subject) filter.subject = new RegExp(`^${escapeRegex(subject.trim())}$`, 'i');
  if (topic) filter.topic = new RegExp(`^${escapeRegex(topic.trim())}$`, 'i');
  if (query && query.trim()) {
    const rx = new RegExp(escapeRegex(query.trim()), 'i');
    filter.$or = ['title', 'subject', 'topic', 'description', 'originalName'].map((f) => ({ [f]: rx }));
  }
  const materials = await Material.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ materials });
});

async function findActive(id) {
  const material = await Material.findOne({ _id: id, status: 'active' }).select('+storedName');
  if (!material) throw new HttpError(404, 'Material not found');
  return material;
}

router.get('/:id', async (req, res) => {
  res.json({ material: await findActive(req.params.id) });
});

// CSMQP-F-013: download
router.get('/:id/download', async (req, res) => {
  const material = await findActive(req.params.id);
  const file = path.join(config.uploadDir, material.storedName);
  if (!fs.existsSync(file)) throw new HttpError(404, 'The stored file is missing');
  res.download(file, material.originalName);
});

module.exports = router;
