import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { pool } from '../src/shared/infrastructure/database/pool.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/infrastructure/password.service.js';

// Prueba real e independiente de datos preexistentes. Todas las escrituras se revierten.
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Un error de integridad no debe abortar las siguientes verificaciones.
  const db = { async query(sql, values) {
    await client.query('SAVEPOINT api_check');
    try {
      const result = await client.query(sql, values);
      await client.query('RELEASE SAVEPOINT api_check');
      return result;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT api_check');
      await client.query('RELEASE SAVEPOINT api_check');
      throw error;
    }
  } };
  const password = randomBytes(24).toString('hex');
  const passwordHash = await hashPassword(password);
  const suffix = randomBytes(8).toString('hex');
  const app = createApp(db);
  const tokens = {};
  const users = {};
  for (const rol of ['ADMIN', 'VENDEDOR', 'INVENTARIO']) {
    const email = `${rol.toLowerCase()}-${suffix}@example.com`;
    const { rows } = await client.query(
      'INSERT INTO usuarios(nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Verificación temporal', email, passwordHash, rol]);
    users[rol] = rows[0].id;
    const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    tokens[rol] = login.body.data.accessToken;
    const me = await request(app).get('/api/auth/me').auth(tokens[rol], { type: 'bearer' }).expect(200);
    assert.equal(me.body.data.rol, rol);
  }
  const as = (pending, rol = 'ADMIN') => pending.auth(tokens[rol], { type: 'bearer' });
  const historical = await client.query("SELECT id, producto_id FROM ventas WHERE NOT inventario_aplicado AND estado='REGISTRADA' LIMIT 1");
  if (historical.rowCount) {
    const old = historical.rows[0];
    const before = await client.query('SELECT stock FROM productos WHERE id=$1', [old.producto_id]);
    await as(request(app).patch(`/api/ventas/${old.id}`)).send({ estado: 'ANULADA', motivo_anulacion: 'Verificar venta histórica' }).expect(200);
    const after = await client.query('SELECT stock FROM productos WHERE id=$1', [old.producto_id]);
    assert.equal(after.rows[0].stock, before.rows[0].stock);
  }
  await request(app).get('/api/productos').expect(401);
  await as(request(app).get('/api/ventas'), 'INVENTARIO').expect(403);
  await as(request(app).post('/api/productos'), 'VENDEDOR').send({ nombre: 'No autorizado', precio: '1' }).expect(403);

  const product = await as(request(app).post('/api/productos'), 'INVENTARIO')
    .send({ nombre: 'Producto temporal', precio: '25.50' }).expect(201);
  const productId = product.body.data.id;
  await as(request(app).post('/api/inventario/movimientos'), 'INVENTARIO')
    .send({ producto_id: productId, tipo: 'ENTRADA', cantidad: 10, motivo: 'Existencias de verificación' }).expect(201);
  const seller = await as(request(app).post('/api/vendedores'))
    .send({ nombre: 'Vendedor temporal', email: `vendedor-${suffix}@example.com` }).expect(201);
  const sellerId = seller.body.data.id;
  await as(request(app).post('/api/vendedores'))
    .send({ nombre: 'Duplicado', email: `vendedor-${suffix}@example.com` }).expect(409);
  const payload = { producto_id: productId, vendedor_id: sellerId, cantidad: 2, precio_unitario: '25.50', fecha: '2026-10-28' };
  const created = await as(request(app).post('/api/ventas'), 'VENDEDOR').send(payload).expect(201);
  const saleId = created.body.data.id;
  assert.equal(created.body.data.total, '51.00');
  assert.equal(created.body.data.registrado_por, users.VENDEDOR);
  await as(request(app).delete(`/api/productos/${productId}`)).expect(409);
  const updated = await as(request(app).patch(`/api/ventas/${saleId}`)).send({ cantidad: 3 }).expect(200);
  assert.equal(updated.body.data.total, '76.50');
  assert.equal(updated.body.data.registrado_por, users.VENDEDOR);

  await as(request(app).patch(`/api/productos/${productId}`), 'INVENTARIO').send({ activo: false }).expect(200);
  await as(request(app).post('/api/ventas'), 'VENDEDOR').send(payload).expect(409);
  for (let repeat = 0; repeat < 2; repeat++) {
    await as(request(app).patch(`/api/ventas/${saleId}`)).send({ estado: 'ANULADA', motivo_anulacion: 'Verificación de anulación' }).expect(200);
  }
  await as(request(app).patch(`/api/ventas/${saleId}`)).send({ cantidad: 4 }).expect(409);
  await as(request(app).patch(`/api/productos/${productId}`), 'INVENTARIO').send({ activo: true }).expect(200);
  await as(request(app).patch(`/api/vendedores/${sellerId}`)).send({ activo: false }).expect(200);
  await as(request(app).post('/api/ventas'), 'VENDEDOR').send(payload).expect(409);

  await client.query("UPDATE usuarios SET rol = 'INVENTARIO' WHERE id = $1", [users.VENDEDOR]);
  await as(request(app).get('/api/ventas'), 'VENDEDOR').expect(403);
  await client.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [users.INVENTARIO]);
  await as(request(app).get('/api/productos'), 'INVENTARIO').expect(401);
  await as(request(app).delete(`/api/ventas/${saleId}`)).expect(405);
  console.log('PostgreSQL real: login, JWT, roles, autor de venta, totales, relaciones, estados y anulación idempotente verificados.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
  console.log('Registros temporales revertidos. Las secuencias de IDs pueden avanzar.');
}
