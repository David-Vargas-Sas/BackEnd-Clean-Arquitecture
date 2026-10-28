import { test } from 'node:test';
import assert from 'node:assert/strict';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { openapi } from '../src/docs/openapi.js';
import { createApp } from '../test-support/create-app.js';

test('OpenAPI es válido y documenta las operaciones y la autenticación', async () => {
  await SwaggerParser.validate(structuredClone(openapi));
  for (const path of ['/api/auth/login', '/api/auth/me', '/api/productos', '/api/ventas/{id}', '/api/usuarios', '/api/inventario/movimientos', '/api/auditoria']) assert.ok(openapi.paths[path]);
  assert.deepEqual(openapi.paths['/api/auth/login'].post.security, []);
  assert.deepEqual(openapi.security, [{ bearerAuth: [] }]);
  assert.ok(openapi.paths['/api/ventas/{id}'].delete.responses[405]);
});

test('la documentación y Swagger UI se sirven sin consultar la base', async () => {
  const app = createApp({ query() { throw new Error('No debería consultar PostgreSQL'); } });
  await request(app).get('/api/openapi.json').expect(200);
  await request(app).get('/api/docs/').expect(200).expect('Content-Type', /html/);
  await request(app).get('/api/docs/swagger-ui-init.js').expect(200);
});
