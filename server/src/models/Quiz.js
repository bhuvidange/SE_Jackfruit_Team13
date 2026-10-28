const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

const quizSchema = new mongoose.Schema(
  {
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    questions: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], validate: (v) => v.length > 0 },
    timeLimitMinutes: { type: Number, required: true, min: 1, max: 300 },
    published: { type: Boolean, default: false, index: true },
    publishedAt: Date,
    eligibility: { type: String, enum: ['all'], default: 'all' },
  },
  { timestamps: true, toJSON: jsonTransform }
);

module.exports = mongoose.model('Quiz', quizSchema);
