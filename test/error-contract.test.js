import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

test('errores HTTP tienen código, mensaje e identificador correlacionable', async () => {
  const app = createApp({ async query() { return { rows: [], rowCount: 0 }; } });
  const cases = [
    [request(app).get('/api/productos/0'), 400, 'VALIDATION_ERROR'],
    [request(app).get('/api/productos/1'), 404, 'NOT_FOUND'],
    [request(app).get('/no-existe'), 404, 'NOT_FOUND'],
    [request(app).post('/api/productos').set('Content-Type', 'application/json').send('{'), 400, 'INVALID_JSON'],
    [request(app).post('/api/productos').send('nombre=Filtro'), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [request(app).post('/api/productos').send({ nombre: 'x'.repeat(33000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ];
  for (const [pending, status, code] of cases) {
    const response = await pending.expect(status);
    assert.equal(response.body.error.code, code);
    assert.equal(typeof response.body.error.message, 'string');
    assert.match(response.body.error.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(response.body.error.requestId, response.headers['x-request-id']);
    assert.deepEqual(Object.keys(response.body), ['error']);
  }
});

test('un error inesperado responde 500 sin filtrar detalles y genera un log correlacionado', async () => {
  const logger = mock.method(console, 'error', () => {});
  try {
    const app = createApp({ async query() { throw new Error('password=secreto SELECT * FROM privado'); } });
    const response = await request(app).get('/api/productos').expect(500);
    assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    assert.equal(response.body.error.message, 'Error interno del servidor.');
    assert.ok(!response.text.includes('secreto'));
    assert.ok(!response.text.includes('stack'));
    assert.equal(logger.mock.callCount(), 1);
    const log = JSON.parse(logger.mock.calls[0].arguments[0]);
    assert.equal(log.requestId, response.body.error.requestId);
    assert.equal(log.status, 500);
  } finally {
    logger.mock.restore();
  }
});
