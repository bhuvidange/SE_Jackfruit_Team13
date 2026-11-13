const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

const reportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['material', 'question'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    status: { type: String, enum: ['open', 'removed', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true, toJSON: jsonTransform }
);

module.exports = mongoose.model('Report', reportSchema);
