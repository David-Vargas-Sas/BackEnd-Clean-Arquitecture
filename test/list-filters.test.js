import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

test('búsqueda y estado se parametrizan antes de paginar', async () => {
  const calls = [];
  const app = createApp({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } });
  await request(app).get('/api/productos').query({ q: "Filtro ' OR 1=1 --", activo: 'false', limit: 10, offset: 10 }).expect(200);
  assert.match(calls[0].sql, /WHERE nombre ILIKE \$3 AND activo = \$4 ORDER BY id LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(calls[0].values, [10, 10, "%Filtro ' OR 1=1 --%", false]);
  assert.ok(!calls[0].sql.includes('OR 1=1'));
});

test('ventas filtra fechas, vendedor, producto y estado con parámetros', async () => {
  const calls = [];
  const app = createApp({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } });
  await request(app).get('/api/ventas').query({ desde: '2026-01-01', hasta: '2026-12-31', vendedor_id: 2, producto_id: 3, estado: 'REGISTRADA' }).expect(200);
  assert.deepEqual(calls[0].values, [10, 0, 3, 2, 'REGISTRADA', '2026-01-01', '2026-12-31']);
  assert.match(calls[0].sql, /fecha >= \$6 AND fecha <= \$7/);
});

test('filtros inválidos no consultan la base', async () => {
  let queries = 0;
  const app = createApp({ query: async () => { queries++; return { rows: [] }; } });
  for (const query of [{ desde: '2026-02-30' }, { desde: '2026-10-02', hasta: '2026-10-01' }, { vendedor_id: '1 OR 1=1' }, { estado: 'INVALIDO' }, { desde: ['2026-01-01', '2026-01-02'] }]) {
    await request(app).get('/api/ventas').query(query).expect(400);
  }
  await request(app).get('/api/productos').query({ activo: 'otro' }).expect(400);
  assert.equal(queries, 0);
});
