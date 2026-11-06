import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../test-support/create-app.js';

function fixture(rows) {
  const calls = [];
  const app = createApp({ async query(sql, values) { calls.push({ sql, values }); return { rows }; } });
  return { app, calls };
}

test('auditoría devuelve cambios y admite consulta general, entidad, registro y filtros combinados', async () => {
  const row = { id: 9, entidad: 'ventas', registro_id: 4, accion: 'EDITAR', usuario_id: 1, antes: { cantidad: 1 }, despues: { cantidad: 2 } };
  for (const [filters, expected] of [
    [{}, [null, null, 10, 0]],
    [{ entidad: 'usuarios' }, ['usuarios', null, 10, 0]],
    [{ registro_id: 4 }, [null, 4, 10, 0]],
    [{ entidad: 'ventas', registro_id: 4, limit: 5, offset: 10 }, ['ventas', 4, 5, 10]],
  ]) {
    const { app, calls } = fixture([row]);
    const result = await request(app).get('/api/auditoria').query(filters).expect(200);
    assert.deepEqual(result.body.data, [row]);
    assert.deepEqual(result.body.pagination, { limit: expected[2], offset: expected[3] });
    assert.deepEqual(calls[0].values, expected);
    assert.match(calls[0].sql, /entidad = \$1/);
    assert.match(calls[0].sql, /registro_id = \$2/);
    assert.match(calls[0].sql, /ORDER BY id DESC LIMIT \$3 OFFSET \$4/);
  }
});

test('auditoría rechaza filtros inválidos antes del SQL y devuelve listas vacías normalmente', async () => {
  const { app, calls } = fixture([]);
  for (const filters of [{ entidad: 'productos' }, { entidad: ['ventas', 'usuarios'] }, { registro_id: '1 OR 1=1' }, { limit: 101 }, { offset: -1 }]) {
    await request(app).get('/api/auditoria').query(filters).expect(400);
  }
  assert.equal(calls.length, 0);
  const empty = await request(app).get('/api/auditoria').expect(200);
  assert.deepEqual(empty.body, { data: [], pagination: { limit: 10, offset: 0 } });
});

test('inventario devuelve movimientos y aplica producto, límite y desplazamiento parametrizados', async () => {
  const row = { id: 3, producto_id: 2, tipo: 'SALIDA', cantidad: -2, stock_resultante: 18, motivo: 'Merma', registrado_por: 1 };
  for (const [filters, expected] of [[{}, [null, 10, 0]], [{ producto_id: 2, limit: 5, offset: 10 }, [2, 5, 10]]]) {
    const { app, calls } = fixture([row]);
    const result = await request(app).get('/api/inventario/movimientos').query(filters).expect(200);
    assert.deepEqual(result.body.data, [row]);
    assert.deepEqual(result.body.pagination, { limit: expected[1], offset: expected[2] });
    assert.deepEqual(calls[0].values, expected);
    assert.match(calls[0].sql, /producto_id = \$1/);
    assert.match(calls[0].sql, /ORDER BY id DESC LIMIT \$2 OFFSET \$3/);
  }
});

test('inventario rechaza productos y paginación inválidos sin consultas y acepta historial vacío', async () => {
  const { app, calls } = fixture([]);
  for (const filters of [{ producto_id: 0 }, { producto_id: '1 OR 1=1' }, { producto_id: ['1', '2'] }, { limit: 0 }]) {
    await request(app).get('/api/inventario/movimientos').query(filters).expect(400);
  }
  assert.equal(calls.length, 0);
  const result = await request(app).get('/api/inventario/movimientos').expect(200);
  assert.deepEqual(result.body, { data: [], pagination: { limit: 10, offset: 0 } });
});
