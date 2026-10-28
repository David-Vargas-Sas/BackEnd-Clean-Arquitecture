import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jwtConfig } from '../test-support/create-app.js';
import { createJwtService } from '../src/modules/auth/infrastructure/jwt.service.js';

function fixture(rol) {
  const calls = [];
  const db = { async query(sql, values) {
    if (sql.includes('SELECT id, nombre, email, rol, activo, token_version FROM usuarios')) return { rows: [{ id: 3, rol, activo: true, token_version: 0 }] };
    calls.push({ sql, values });
    return { rows: [{ id: 1 }], rowCount: 1 };
  } };
  return { app: createApp(db, { jwtConfig }), token: createJwtService(jwtConfig).sign(3), calls };
}

test('usuarios y auditoría están restringidos a ADMIN', async () => {
  for (const rol of ['VENDEDOR', 'INVENTARIO']) {
    const { app, token, calls } = fixture(rol);
    for (const path of ['/api/usuarios', '/api/usuarios/1', '/api/auditoria']) {
      await request(app).get(path).auth(token, { type: 'bearer' }).expect(403);
    }
    await request(app).post('/api/usuarios').auth(token, { type: 'bearer' }).send({}).expect(403);
    await request(app).patch('/api/usuarios/1').auth(token, { type: 'bearer' }).send({ rol: 'ADMIN' }).expect(403);
    assert.equal(calls.length, 0);
  }
});

test('inventario exige permiso y solo acepta movimientos manuales válidos', async () => {
  const { app, token, calls } = fixture('INVENTARIO');
  const input = { producto_id: 1, tipo: 'SALIDA', cantidad: 2, motivo: 'Mercancía dañada' };
  await request(app).post('/api/inventario/movimientos').auth(token, { type: 'bearer' }).send(input).expect(201);
  assert.deepEqual(calls[0].values, [1, 'SALIDA', -2, 3, 'Mercancía dañada']);
  for (const invalid of [{ ...input, cantidad: -1 }, { ...input, tipo: 'ANULACION' }, { ...input, registrado_por: 8 }, { ...input, motivo: '' }]) {
    await request(app).post('/api/inventario/movimientos').auth(token, { type: 'bearer' }).send(invalid).expect(400);
  }
  await request(app).patch('/api/productos/1').auth(token, { type: 'bearer' }).send({ stock: 500 }).expect(400);
  assert.equal(calls.length, 1);
  const seller = fixture('VENDEDOR');
  await request(seller.app).post('/api/inventario/movimientos').auth(seller.token, { type: 'bearer' }).send(input).expect(403);
});

test('administración valida roles, contraseñas y campos del usuario antes de escribir', async () => {
  const { app, token, calls } = fixture('ADMIN');
  for (const input of [{ password: '1234' }, { rol: 'SUPERADMIN' }, { activo: 'false' }, { token_version: 0 }, { password_hash: 'fake' }, {}]) {
    await request(app).patch('/api/usuarios/1').auth(token, { type: 'bearer' }).send(input).expect(400);
  }
  await request(app).post('/api/usuarios').auth(token, { type: 'bearer' }).send({ nombre: 'Ana', email: 'ana@example.com', password: 'corta' }).expect(400);
  assert.equal(calls.length, 0);
});
