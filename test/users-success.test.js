import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';
import { verifyPassword } from '../src/modules/auth/infrastructure/password.service.js';

const profile = { id: 7, nombre: 'Ana', email: 'ana@example.com', rol: 'VENDEDOR', activo: true, creado_en: '2026-11-06T12:00:00.000Z' };
function fixture(rows = [profile]) {
  const calls = [];
  const app = createApp({ async query(sql, values) { calls.push({ sql, values }); return { rows, rowCount: rows.length }; } });
  return { app, calls };
}
function assertPublicProjection(sql) {
  const projection = sql.includes('RETURNING') ? sql.split('RETURNING')[1] : sql.slice(0, sql.indexOf('FROM'));
  assert.ok(!projection.includes('*'), 'No seleccionar todas las columnas de usuarios.');
  assert.ok(!/password|token_version/.test(projection), 'No devolver credenciales ni versión de tokens.');
}

test('crear usuario normaliza datos, guarda un hash verificable y devuelve solo el perfil público', async () => {
  const { app, calls } = fixture();
  const password = 'test-user-password-123+';
  const result = await request(app).post('/api/usuarios').send({ nombre: ' Ana ', email: 'ANA@example.com', password }).expect(201);
  assert.equal(result.headers.location, '/api/usuarios/7');
  assert.deepEqual(result.body.data, profile);
  const { sql, values } = calls[0];
  assert.match(sql, /^INSERT INTO usuarios/);
  assert.deepEqual(values.slice(0, 3), ['Ana', 'ana@example.com', 'VENDEDOR']);
  assert.equal(values[4], 1, 'El autor proviene de la sesión de prueba.');
  assert.notEqual(values[3], password);
  assert.ok(await verifyPassword(password, values[3]));
  assertPublicProjection(sql);
  assert.ok(!result.text.includes(password));
  assert.ok(!result.text.includes('password_hash'));
});

test('listado de usuarios filtra búsqueda, estado y rol antes de paginar sin exponer credenciales', async () => {
  const { app, calls } = fixture();
  const result = await request(app).get('/api/usuarios').query({ q: 'Ana', activo: 'true', rol: 'VENDEDOR', limit: 5, offset: 10 }).expect(200);
  assert.deepEqual(result.body.data, [profile]);
  assert.deepEqual(result.body.pagination, { limit: 5, offset: 10 });
  assert.deepEqual(calls[0].values, [5, 10, '%Ana%', true, 'VENDEDOR']);
  assert.match(calls[0].sql, /WHERE .* ILIKE \$3.*activo = \$4.*rol = \$5.*LIMIT \$1 OFFSET \$2/);
  assertPublicProjection(calls[0].sql);
});

test('consultar usuario devuelve perfil público y responde 404 cuando no existe', async () => {
  const found = fixture();
  const result = await request(found.app).get('/api/usuarios/7').expect(200);
  assert.deepEqual(result.body.data, profile);
  assert.deepEqual(found.calls[0].values, [7]);
  assertPublicProjection(found.calls[0].sql);
  const missing = fixture([]);
  const failure = await request(missing.app).get('/api/usuarios/999').expect(404);
  assert.equal(failure.body.error.code, 'NOT_FOUND');
});

test('editar datos, rol y estado de usuario conserva la contraseña y la versión de tokens', async () => {
  const updated = { ...profile, nombre: 'Ana Pérez', email: 'nuevo@example.com', rol: 'INVENTARIO', activo: false };
  const { app, calls } = fixture([updated]);
  const result = await request(app).patch('/api/usuarios/7').send({ nombre: ' Ana Pérez ', email: 'NUEVO@example.com', rol: 'INVENTARIO', activo: false }).expect(200);
  assert.deepEqual(result.body.data, updated);
  assert.deepEqual(calls[0].values, ['Ana Pérez', 'nuevo@example.com', 'INVENTARIO', false, 1, 7]);
  assert.ok(!calls[0].sql.includes('password_hash'));
  assert.ok(!calls[0].sql.includes('token_version'));
  assertPublicProjection(calls[0].sql);
});

test('cambiar contraseña guarda otro hash y solicita incrementar la versión de tokens', async () => {
  const { app, calls } = fixture();
  const password = 'another-test-password-456+';
  const result = await request(app).patch('/api/usuarios/7').send({ password }).expect(200);
  assert.match(calls[0].sql, /password_hash = \$1/);
  assert.match(calls[0].sql, /token_version = token_version \+ 1/);
  assert.ok(await verifyPassword(password, calls[0].values[0]));
  assert.deepEqual(calls[0].values.slice(1), [1, 7]);
  assertPublicProjection(calls[0].sql);
  assert.deepEqual(result.body.data, profile);
  assert.ok(!result.text.includes('scrypt-v1'));
});

test('editar un usuario inexistente responde 404 y los filtros de rol inválidos no consultan la base', async () => {
  const missing = fixture([]);
  await request(missing.app).patch('/api/usuarios/999').send({ nombre: 'Nuevo' }).expect(404);
  const invalid = fixture();
  await request(invalid.app).get('/api/usuarios').query({ rol: 'SUPERADMIN' }).expect(400);
  assert.equal(invalid.calls.length, 0);
});
