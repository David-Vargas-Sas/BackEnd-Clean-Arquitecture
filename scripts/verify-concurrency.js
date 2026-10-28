import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { migrate } from '../src/shared/infrastructure/database/migrator.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/infrastructure/password.service.js';
import { createJwtService } from '../src/modules/auth/infrastructure/jwt.service.js';

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
const schema = `verification_${randomBytes(10).toString('hex')}`;
assert.match(schema, /^verification_[a-f0-9]{20}$/);
const maintenance = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let db;
let created = false;
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 10, statement_timeout: 10000 });
  await migrate(db);
  await migrate(db);
  const count = await db.query('SELECT count(*)::integer AS count FROM schema_migrations');
  assert.equal(count.rows[0].count, 5);
  await db.query(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT stock FROM productos ORDER BY id LIMIT 1')).rows[0].stock, 98);

  const password = randomBytes(20).toString('hex');
  const hash = await hashPassword(password);
  const { rows: [admin] } = await db.query("INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES ('Admin','admin@example.com',$1,'ADMIN') RETURNING id", [hash]);
  const app = createApp(db);
  const tokens = createJwtService();
  const adminToken = tokens.sign(admin.id);
  const asAdmin = (pending) => pending.auth(adminToken, { type: 'bearer' });
  const product = await asAdmin(request(app).post('/api/productos')).send({ nombre: 'Última unidad', precio: '10.00' }).expect(201);
  const pid = product.body.data.id;
  assert.equal(product.body.data.stock, 0);
  const seller = await asAdmin(request(app).post('/api/vendedores')).send({ nombre: 'Vendedor', email: 'seller@example.com' }).expect(201);
  const sale = { producto_id: pid, vendedor_id: seller.body.data.id, cantidad: 1, precio_unitario: '10.00', fecha: '2026-10-28' };
  await asAdmin(request(app).post('/api/inventario/movimientos')).send({ producto_id: pid, tipo: 'ENTRADA', cantidad: 1, motivo: 'Compra inicial' }).expect(201);
  const attempts = await Promise.all([1, 2].map(() => asAdmin(request(app).post('/api/ventas')).send(sale)));
  assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);
  const saleId = attempts.find((response) => response.status === 201).body.data.id;
  assert.equal((await db.query('SELECT stock FROM productos WHERE id=$1', [pid])).rows[0].stock, 0);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM movimientos_inventario WHERE tipo='VENTA' AND producto_id=$1", [pid])).rows[0].count, 1);
  console.log('Concurrencia: dos ventas sobre la última unidad producen una venta y un conflicto; stock cero.');

  const cancellations = await Promise.all([1, 2].map(() => asAdmin(request(app).patch(`/api/ventas/${saleId}`))
    .send({ estado: 'ANULADA', motivo_anulacion: 'Cliente canceló' })));
  assert.deepEqual(cancellations.map((response) => response.status), [200, 200]);
  assert.equal((await db.query('SELECT stock FROM productos WHERE id=$1', [pid])).rows[0].stock, 1);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM movimientos_inventario WHERE tipo='ANULACION'")).rows[0].count, 1);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM auditoria WHERE entidad='ventas' AND accion='ANULAR'")).rows[0].count, 1);
  await asAdmin(request(app).delete(`/api/ventas/${saleId}`)).expect(405);
  await assert.rejects(db.query('DELETE FROM ventas WHERE id=$1', [saleId]), (error) => error.code === 'P1004');
  await assert.rejects(db.query('UPDATE movimientos_inventario SET motivo=$1', ['alterar']), (error) => error.code === 'P1004');
  console.log('Anulaciones simultáneas: una sola devolución y una sola entrada de auditoría; historial protegido.');

  const failed = await asAdmin(request(app).post('/api/ventas')).send({ ...sale, cantidad: 2 }).expect(409);
  assert.equal(failed.body.error.code, 'CONFLICT');
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM ventas WHERE producto_id=$1', [pid])).rows[0].count, 1);
  const sale2 = await asAdmin(request(app).post('/api/ventas')).send(sale).expect(201);
  await asAdmin(request(app).patch(`/api/ventas/${sale2.body.data.id}`)).send({ cantidad: 3 }).expect(409);
  assert.equal((await db.query('SELECT cantidad FROM ventas WHERE id=$1', [sale2.body.data.id])).rows[0].cantidad, 1);
  console.log('Atomicidad: fallos de stock revierten la venta, su edición y sus movimientos.');

  const product2 = await asAdmin(request(app).post('/api/productos')).send({ nombre: 'Segundo producto', precio: '10.00' }).expect(201);
  await asAdmin(request(app).post('/api/inventario/movimientos')).send({ producto_id: product2.body.data.id, tipo: 'ENTRADA', cantidad: 3, motivo: 'Compra' }).expect(201);
  const changed = await asAdmin(request(app).patch(`/api/ventas/${sale2.body.data.id}`)).send({ producto_id: product2.body.data.id, cantidad: 2 }).expect(200);
  assert.equal(changed.body.data.cantidad, 2);
  assert.equal((await db.query('SELECT stock FROM productos WHERE id=$1', [pid])).rows[0].stock, 1);
  assert.equal((await db.query('SELECT stock FROM productos WHERE id=$1', [product2.body.data.id])).rows[0].stock, 1);

  const newUser = await asAdmin(request(app).post('/api/usuarios')).send({ nombre: 'Operador', email: 'operator@example.com', password, rol: 'INVENTARIO' }).expect(201);
  assert.equal(newUser.body.data.password_hash, undefined);
  let login = await request(app).post('/api/auth/login').send({ email: 'operator@example.com', password }).expect(200);
  assert.ok(login.body.data.user.permisos.includes('inventario:create'));
  assert.ok(!login.body.data.user.permisos.includes('ventas:create'));
  const oldToken = login.body.data.accessToken;
  await request(app).post('/api/usuarios').auth(oldToken, { type: 'bearer' }).send({ nombre: 'Intruso', email: 'intruso@example.com', password }).expect(403);
  await asAdmin(request(app).patch(`/api/usuarios/${newUser.body.data.id}`)).send({ password: `${password}nueva` }).expect(200);
  await request(app).get('/api/auth/me').auth(oldToken, { type: 'bearer' }).expect(401);
  login = await request(app).post('/api/auth/login').send({ email: 'operator@example.com', password: `${password}nueva` }).expect(200);
  await asAdmin(request(app).patch(`/api/usuarios/${newUser.body.data.id}`)).send({ rol: 'VENDEDOR' }).expect(200);
  const me = await request(app).get('/api/auth/me').auth(login.body.data.accessToken, { type: 'bearer' }).expect(200);
  assert.ok(me.body.data.permisos.includes('ventas:create'));
  const audit = await asAdmin(request(app).get('/api/auditoria?entidad=usuarios')).expect(200);
  assert.ok(!JSON.stringify(audit.body).includes('password_hash'));
  assert.ok(!JSON.stringify(audit.body).includes(hash));
  console.log('Usuarios: roles, permisos para Angular, cambio de contraseña, revocación de tokens y auditoría sin hashes verificados.');

  const secondAdmin = await asAdmin(request(app).post('/api/usuarios')).send({ nombre: 'Admin 2', email: 'admin2@example.com', password, rol: 'ADMIN' }).expect(201);
  const otherToken = tokens.sign(secondAdmin.body.data.id);
  const deactivations = await Promise.all([
    asAdmin(request(app).patch(`/api/usuarios/${admin.id}`)).send({ activo: false }),
    request(app).patch(`/api/usuarios/${secondAdmin.body.data.id}`).auth(otherToken, { type: 'bearer' }).send({ activo: false }),
  ]);
  assert.deepEqual(deactivations.map((response) => response.status).sort(), [200, 409]);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM usuarios WHERE rol='ADMIN' AND activo")).rows[0].count, 1);
  console.log('Administradores concurrentes: no se puede desactivar al último administrador activo.');
} finally {
  if (db) await db.end();
  if (created) {
    assert.match(schema, /^verification_[a-f0-9]{20}$/);
    await maintenance.query(`DROP SCHEMA "${schema}" CASCADE`);
    console.log('Esquema temporal de verificación eliminado; la base del proyecto se conserva.');
  }
  await maintenance.end();
}
