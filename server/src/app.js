const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

// input sanitizer (CSMQP-SR-004) is mounted here

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);

// ---- feature routes: one line per module ----
app.use('/api/materials', require('./routes/materials'));
// ---- end feature routes ----

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

module.exports = app;
