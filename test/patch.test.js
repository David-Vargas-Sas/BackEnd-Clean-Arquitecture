import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

test('PATCH actualiza solo campos presentes y permite desactivar o anular', async () => {
  for (const [resource, input] of [
    ['productos', { activo: false }],
    ['vendedores', { activo: true }],
    ['productos', { precio: '15.50' }],
    ['vendedores', { email: ' ANA@EXAMPLE.COM ' }],
    ['ventas', { estado: 'ANULADA', motivo_anulacion: 'Cliente canceló' }],
    ['ventas', { cantidad: 3 }],
  ]) {
    const calls = [];
    const app = createApp({ async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ id: 1, ...input }], rowCount: 1 };
    } });
    await request(app).patch(`/api/${resource}/1`).send(input).expect(200);
    assert.equal(calls.length, 1);
    const field = Object.keys(input)[0];
    assert.ok(calls[0].sql.includes(`SET ${field} = $1`));
    assert.equal(calls[0].values[0], field === 'email' ? 'ana@example.com' : input[field]);
    assert.equal(calls[0].values.at(-1), 1);
  }
});

test('PATCH rechaza campos inválidos, cuerpos vacíos y reactivación de ventas', async () => {
  let calls = 0;
  const app = createApp({ async query() { calls++; return { rows: [] }; } });
  for (const [resource, input] of [
    ['productos', {}], ['productos', { activo: 'false' }],
    ['productos', { precio: null }], ['productos', { id: 1 }],
    ['ventas', { estado: 'REGISTRADA' }], ['ventas', { estado: 'ANULADA', cantidad: 2 }],
    ['vendedores', { email: 'incorrecto' }],
  ]) await request(app).patch(`/api/${resource}/1`).send(input).expect(400);
  assert.equal(calls, 0);
  await request(app).patch('/api/productos/1').send({ activo: false }).expect(404);
});

test('conflictos de estados de PostgreSQL se traducen a HTTP 409', async () => {
  for (const code of ['P1001', 'P1002']) {
    const app = createApp({ async query() { throw Object.assign(new Error('privado'), { code }); } });
    const response = await request(app).patch('/api/ventas/1').send({ cantidad: 2 }).expect(409);
    assert.equal(response.body.error.code, 'CONFLICT');
    assert.ok(!response.text.includes('privado'));
  }
});
