import assert from 'node:assert/strict';
import request from 'supertest';
import { pool } from '../src/shared/infrastructure/database/pool.js';
import { createApp } from '../test-support/create-app.js';

// Solo lectura; usa una aplicación aislada, sin modificar el servidor local.
try {
  const app = createApp(pool);
  for (const resource of ['productos', 'vendedores', 'usuarios']) {
    const empty = await request(app).get('/api/' + resource).query({ q: 'no-coincide-filtro-7e84d3cb9b', activo: 'true' }).expect(200);
    assert.deepEqual(empty.body.data, []);
    const active = await request(app).get('/api/' + resource).query({ activo: 'false', limit: 2 }).expect(200);
    assert.ok(active.body.data.every(row => row.activo === false));
    console.log(resource + ': búsqueda y estado comprobados en PostgreSQL.');
  }
  const sales = await request(app).get('/api/ventas').query({ desde: '2026-01-01', hasta: '2026-12-31', estado: 'REGISTRADA' }).expect(200);
  assert.ok(sales.body.data.every(row => row.estado === 'REGISTRADA' && String(row.fecha).slice(0, 10) >= '2026-01-01' && String(row.fecha).slice(0, 10) <= '2026-12-31'));
  console.log('Ventas: rango de fechas y estado comprobados en PostgreSQL.');
} finally { await pool.end(); }
