const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

const questionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['mcq', 'tf'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: { type: [String], required: true },
    // Index of the one correct option in `options`.
    correctAnswer: { type: Number, required: true, min: 0 },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
  },
  { timestamps: true, toJSON: jsonTransform }
);

questionSchema.index({ subject: 1, topic: 1, difficulty: 1 });

module.exports = mongoose.model('Question', questionSchema);
