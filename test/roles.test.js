import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jwtConfig } from '../test-support/create-app.js';
import { createJwtService } from '../src/modules/auth/infrastructure/jwt.service.js';

const inputs = {
  productos: { nombre: 'Filtro', precio: '25.00' },
  vendedores: { nombre: 'Ana', email: 'ana@example.com' },
  ventas: { producto_id: 1, vendedor_id: 1, cantidad: 2, precio_unitario: '25.00', fecha: '2026-10-28' },
};

function fixture(initialRole) {
  let role = initialRole;
  const writes = [];
  const db = { async query(sql, values) {
    if (sql.includes('FROM usuarios')) return { rows: [{ id: 7, nombre: 'Ana', email: 'ana@example.com', rol: role, activo: true }] };
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) writes.push({ sql, values });
    return { rows: [{ id: 1 }], rowCount: 1 };
  } };
  return {
    app: createApp(db, { jwtConfig }), writes,
    token: createJwtService(jwtConfig).sign(7),
    setRole(value) { role = value; },
  };
}

test('matriz de roles protege todos los métodos de cada recurso', async () => {
  const allowed = {
    ADMIN: { productos: ['get', 'head', 'post', 'put', 'patch', 'delete'], vendedores: ['get', 'head', 'post', 'put', 'patch', 'delete'], ventas: ['get', 'head', 'post', 'put', 'patch', 'delete'] },
    VENDEDOR: { productos: ['get', 'head'], vendedores: ['get', 'head'], ventas: ['get', 'head', 'post'] },
    INVENTARIO: { productos: ['get', 'head', 'post', 'put', 'patch'], vendedores: [], ventas: [] },
  };
  for (const [role, resources] of Object.entries(allowed)) {
    const { app, token, writes } = fixture(role);
    for (const [resource, methods] of Object.entries(resources)) {
      for (const method of ['get', 'head', 'post', 'put', 'patch', 'delete']) {
        const canAccess = methods.includes(method);
        const path = `/api/${resource}${['put', 'patch', 'delete'].includes(method) ? '/1' : ''}`;
        let pending = request(app)[method](path).auth(token, { type: 'bearer' });
        if (['post', 'put', 'patch'].includes(method)) pending = pending.send(inputs[resource]);
        const previousWrites = writes.length;
        const expected = resource === 'ventas' && method === 'delete' ? 405 : canAccess ? (method === 'post' ? 201 : method === 'delete' ? 204 : 200) : 403;
        const response = await pending.expect(expected);
        if (expected === 403) {
          assert.equal(writes.length, previousWrites);
          if (method !== 'head') {
            assert.equal(response.body.error.code, 'FORBIDDEN');
            assert.equal(response.body.error.requestId, response.headers['x-request-id']);
          }
        }
      }
    }
  }
});

test('los cambios de rol se aplican con el mismo token y roles desconocidos no tienen permisos', async () => {
  const context = fixture('ADMIN');
  await request(context.app).get('/api/ventas').auth(context.token, { type: 'bearer' }).expect(200);
  context.setRole('INVENTARIO');
  await request(context.app).get('/api/ventas').auth(context.token, { type: 'bearer' }).expect(403);
  await request(context.app).get('/api/productos').auth(context.token, { type: 'bearer' }).expect(200);
  context.setRole('DESCONOCIDO');
  await request(context.app).get('/api/productos').auth(context.token, { type: 'bearer' }).expect(403);
});

test('la venta registra el usuario autenticado y rechaza suplantar al autor', async () => {
  const { app, token, writes } = fixture('VENDEDOR');
  await request(app).post('/api/ventas').auth(token, { type: 'bearer' }).send(inputs.ventas).expect(201);
  assert.ok(writes[0].sql.includes('registrado_por'));
  assert.equal(writes[0].values.at(-1), 7);
  await request(app).post('/api/ventas').auth(token, { type: 'bearer' }).send({ ...inputs.ventas, registrado_por: 99 }).expect(400);
  assert.equal(writes.length, 1);
});
