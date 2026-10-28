import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

function fixture(result = { rows: [], rowCount: 0 }) {
  const calls = [];
  const db = { async query(sql, values) { calls.push({ sql, values }); if (result instanceof Error) throw result; return result; } };
  return { app: createApp(db), calls };
}

test('rechaza entradas inválidas antes de consultar PostgreSQL', async () => {
  const { app, calls } = fixture();
  for (const id of ['0', '-1', 'abc', '2147483648', '1%20OR%201=1']) await request(app).get(`/api/productos/${id}`).expect(400);
  for (const precio of [-1, true, null, '1.234', '1e3']) await request(app).post('/api/productos').send({ nombre: 'Aceite', precio }).expect(400);
  await request(app).post('/api/vendedores').send({ nombre: 'Ana', email: 'incorrecto' }).expect(400);
  const sale = { producto_id: 1, vendedor_id: 1, cantidad: 1, precio_unitario: '12.50', fecha: '2026-02-30' };
  await request(app).post('/api/ventas').send(sale).expect(400);
  await request(app).post('/api/ventas').send({ ...sale, fecha: '2026-02-28', cantidad: 0 }).expect(400);
  await request(app).post('/api/productos').send({ nombre: 'Aceite', precio: 10, id: 99 }).expect(400);
  await request(app).get('/api/productos?limit=101').expect(400);
  assert.equal(calls.length, 0);
});

test('CRUD de los tres recursos usa parámetros y estados HTTP correctos', async () => {
  const examples = {
    productos: { nombre: "Filtro ' especial", descripcion: '', precio: '25.50' },
    vendedores: { nombre: 'Ana', email: 'ana@example.com' },
    ventas: { producto_id: 1, vendedor_id: 1, cantidad: 2, precio_unitario: '25.50', fecha: '2026-10-01' },
  };
  for (const [resource, body] of Object.entries(examples)) {
    const row = { id: 1, ...body };
    const { app, calls } = fixture({ rows: [row], rowCount: 1 });
    const created = await request(app).post(`/api/${resource}`).send(body).expect(201);
    assert.equal(created.headers.location, `/api/${resource}/1`);
    assert.deepEqual(created.body.data, row);
    assert.ok(calls[0].sql.includes('$1'));
    assert.ok(!calls[0].sql.includes(body.nombre || body.fecha));
    const list = await request(app).get(`/api/${resource}?limit=10&offset=2`).expect(200);
    assert.deepEqual(list.body.data, [row]);
    assert.deepEqual(calls[1].values, [10, 2]);
    await request(app).get(`/api/${resource}/1`).expect(200);
    await request(app).put(`/api/${resource}/1`).send(body).expect(200);
    const removed = await request(app).delete(`/api/${resource}/1`).expect(resource === 'ventas' ? 405 : 204);
    if (resource !== 'ventas') assert.equal(removed.text, '');
    else assert.equal(removed.body.error.code, 'METHOD_NOT_ALLOWED');
  }
});

test('registros inexistentes responden 404', async () => {
  const { app } = fixture();
  await request(app).get('/api/productos/999').expect(404);
  await request(app).put('/api/productos/999').send({ nombre: 'Filtro', precio: 10 }).expect(404);
  await request(app).delete('/api/productos/999').expect(404);
  await request(app).get('/desconocida').expect(404);
});

test('conflictos de integridad y JSON inválido tienen respuestas claras', async () => {
  for (const code of ['23503', '23001', '23505']) {
    const { app } = fixture(Object.assign(new Error('detalle SQL privado'), { code }));
    const response = await request(app).delete('/api/productos/1').expect(409);
    assert.ok(!response.text.includes('detalle SQL privado'));
  }
  const { app } = fixture();
  await request(app).post('/api/productos').set('Content-Type', 'application/json').send('{').expect(400);
});

test('health consulta la base de datos y CORS permite el frontend local', async () => {
  const { app, calls } = fixture();
  const response = await request(app).get('/api/health').set('Origin', 'http://localhost:4200').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(calls[0].sql, 'SELECT 1');
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:4200');
});
