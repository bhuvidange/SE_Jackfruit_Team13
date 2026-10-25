const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

const materialSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    originalName: { type: String, required: true },
    format: { type: String, enum: ['pdf', 'docx', 'pptx', 'jpg'], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    // File name on disk (random); never derived from user input.
    storedName: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
  },
  {
    timestamps: true,
    toJSON: {
      ...jsonTransform,
      transform: (doc, ret) => {
        jsonTransform.transform(doc, ret);
        delete ret.storedName;
        return ret;
      },
    },
  }
);

materialSchema.index({ title: 'text', subject: 'text', topic: 'text', description: 'text' });

module.exports = mongoose.model('Material', materialSchema);
