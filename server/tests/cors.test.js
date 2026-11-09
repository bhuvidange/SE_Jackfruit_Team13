const express = require('express');
const request = require('supertest');
const corsAllowList = require('../src/middleware/cors');

function appFor(origins) {
  const app = express();
  app.use(corsAllowList({ origin: origins }));
  app.get('/resource', (req, res) => res.json({ ok: true }));
  return app;
}

describe('CORS origin allow-list', () => {
  const app = appFor(['http://localhost:5173', 'https://csmqp.example']);

  test('allows only configured exact origins', async () => {
    const allowed = await request(app).get('/resource').set('Origin', 'https://csmqp.example');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://csmqp.example');
    expect(allowed.headers.vary).toMatch(/Origin/);
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();

    const unlisted = await request(app).get('/resource').set('Origin', 'https://attacker.example');
    expect(unlisted.status).toBe(200);
    expect(unlisted.headers['access-control-allow-origin']).toBeUndefined();

    const lookalike = await request(app).get('/resource').set('Origin', 'https://csmqp.example.attacker.example');
    expect(lookalike.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('does not add CORS grants to requests without an Origin header', async () => {
    const response = await request(app).get('/resource');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('preflight only grants listed origins', async () => {
    const allowed = await request(app)
      .options('/resource')
      .set('Origin', 'https://csmqp.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://csmqp.example');
    expect(allowed.headers['access-control-allow-methods']).toMatch(/POST/);

    const unlisted = await request(app)
      .options('/resource')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(unlisted.headers['access-control-allow-origin']).toBeUndefined();
  });

  test.each(['*', 'null', 'https://example.com/path', 'file:///tmp'])('rejects invalid configured origin %s', (origin) => {
    expect(() => corsAllowList({ origin: [origin] })).toThrow(/exact HTTP\(S\) origins/);
  });

  test('rejects an empty allow-list', () => {
    expect(() => corsAllowList({ origin: [] })).toThrow(/at least one frontend origin/i);
  });
});
