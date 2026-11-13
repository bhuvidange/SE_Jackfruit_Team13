
const express = require('express');
const helmet = require('helmet');
const cors = require('./middleware/cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

// Input sanitizer (CSMQP-SR-004)
app.use(require('./middleware/sanitize'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok' })
);

app.use('/api/auth', authRoutes);

// ---- feature routes: one line per module ----
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
// ---- end feature routes ----

app.use((req, res) =>
  res.status(404).json({ message: 'Not found' })
);

app.use(errorHandler);

module.exports = app;
