const mongoose = require('mongoose');
const jsonTransform = require('../utils/jsonTransform');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  },
  { timestamps: true, toJSON: jsonTransform }
);

module.exports = mongoose.model('User', userSchema);
