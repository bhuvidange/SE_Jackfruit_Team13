const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

// Snapshot of one graded question, so later edits to the bank never change a past result.
const gradedSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    text: String,
    options: [String],
    selected: { type: Number, default: null },
    correctAnswer: Number,
    correct: Boolean,
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['in_progress', 'submitted', 'expired'], default: 'in_progress' },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: Date,
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    graded: [gradedSchema],
  },
  { timestamps: true, toJSON: jsonTransform }
);

// One attempt per student per quiz.
attemptSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', attemptSchema);
