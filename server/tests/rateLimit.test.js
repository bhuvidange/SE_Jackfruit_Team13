const express = require('express');
const request = require('supertest');
const rateLimit = require('../src/middleware/rateLimit');
const errorHandler = require('../src/middleware/errorHandler');

function appWith(limiter) {
  const app = express();
  app.get('/limited', limiter, (req, res) => res.json({ ok: true }));
  app.get('/open', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('rate limiter middleware (unit)', () => {
  afterEach(() => jest.useRealTimers());

  test('allows up to max requests, then returns 429 with Retry-After', async () => {
    const app = appWith(rateLimit({ windowMs: 60000, max: 2, message: 'Slow down' }));
    const first = await request(app).get('/limited');
    expect(first.status).toBe(200);
    expect(first.headers['ratelimit-limit']).toBe('2');
    expect(first.headers['ratelimit-remaining']).toBe('1');
    expect((await request(app).get('/limited')).status).toBe(200);

    const blocked = await request(app).get('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe('Slow down');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
  });

  test('routes without the limiter are unaffected', async () => {
    const app = appWith(rateLimit({ windowMs: 60000, max: 1 }));
    await request(app).get('/limited');
    expect((await request(app).get('/limited')).status).toBe(429);
    expect((await request(app).get('/open')).status).toBe(200);
  });

  test('the count resets once the window has passed', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const app = appWith(rateLimit({ windowMs: 1000, max: 1 }));
    expect((await request(app).get('/limited')).status).toBe(200);
    expect((await request(app).get('/limited')).status).toBe(429);
    jest.advanceTimersByTime(1001);
    expect((await request(app).get('/limited')).status).toBe(200);
  });

  test('reset() clears all counters', async () => {
    const limiter = rateLimit({ windowMs: 60000, max: 1 });
    const app = appWith(limiter);
    await request(app).get('/limited');
    expect((await request(app).get('/limited')).status).toBe(429);
    limiter.reset();
    expect((await request(app).get('/limited')).status).toBe(200);
  });
});

describe('auth routes are rate limited', () => {
  // A fresh copy of the app with a tiny limit. Invalid bodies are rejected before any database
  // access, so no connection is needed.
  function freshApp(max) {
    const previous = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = String(max);
    let app;
    jest.isolateModules(() => {
      app = require('../src/app');
    });
    process.env.AUTH_RATE_LIMIT_MAX = previous;
    return app;
  }

  test('login returns 429 after the configured number of attempts', async () => {
    const app = freshApp(3);
    for (let i = 0; i < 3; i++) expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many login attempts/i);
    expect(res.headers['retry-after']).toBeDefined();
  });

  test('register has its own budget, separate from login', async () => {
    const app = freshApp(1);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(429);
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
