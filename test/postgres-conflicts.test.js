import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

function failingApp(code) {
  return createApp({ async query() { throw Object.assign(new Error('Detalle privado: SELECT password_hash FROM usuarios'), { code }); } });
}

test('errores de integridad, estado y concurrencia responden 409 sin detalles del driver', async () => {
  for (const code of ['P1001', 'P1002', 'P1003', 'P1004', 'P1005', '23505', '23503', '23001', '40P01', '40001', '55P03']) {
    const result = await request(failingApp(code)).post('/api/productos').send({ nombre: 'Filtro', precio: '25000.00' }).expect(409);
    assert.equal(result.body.error.code, 'CONFLICT');
    assert.ok(!result.text.includes('password_hash'));
    assert.ok(!result.text.includes('Detalle privado'));
    assert.equal(result.body.error.requestId, result.headers['x-request-id']);
  }
});

test('restricciones de datos de PostgreSQL responden 400 sin filtrar SQL', async () => {
  for (const code of ['23514', '23502', '22003', '22007', '22008']) {
    const result = await request(failingApp(code)).post('/api/productos').send({ nombre: 'Filtro', precio: 10 }).expect(400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.ok(!result.text.includes('SELECT'));
    assert.ok(!result.text.includes('password_hash'));
  }
});

test('una referencia inválida al crear y un borrado con historial tienen mensajes adecuados', async () => {
  const created = await request(failingApp('23503')).post('/api/productos').send({ nombre: 'Filtro', precio: 10 }).expect(409);
  assert.match(created.body.error.message, /no existe/);
  const removed = await request(failingApp('23503')).delete('/api/productos/7').expect(409);
  assert.match(removed.body.error.message, /asociadas/);
});

test('usuarios traduce duplicados y conflictos del último administrador al crear o actualizar', async () => {
  const duplicate = await request(failingApp('23505')).post('/api/usuarios').send({ nombre: 'Ana', email: 'ana@example.com', password: 'test-password-long-123+' }).expect(409);
  assert.equal(duplicate.body.error.code, 'CONFLICT');
  assert.ok(!duplicate.text.includes('password_hash'));
  const lastAdmin = await request(failingApp('P1005')).patch('/api/usuarios/7').send({ activo: false }).expect(409);
  assert.match(lastAdmin.body.error.message, /administrador activo/);
});

test('inventario traduce stock insuficiente y producto inexistente al registrar un movimiento', async () => {
  const input = { producto_id: 7, tipo: 'SALIDA', cantidad: 2, motivo: 'Merma' };
  const stock = await request(failingApp('P1003')).post('/api/inventario/movimientos').send(input).expect(409);
  assert.match(stock.body.error.message, /Stock insuficiente/);
  const missing = await request(failingApp('23503')).post('/api/inventario/movimientos').send(input).expect(409);
  assert.match(missing.body.error.message, /no existe/);
});
