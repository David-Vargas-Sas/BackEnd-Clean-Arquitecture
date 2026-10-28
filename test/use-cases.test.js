import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProductoUseCases } from '../src/modules/productos/application/producto.use-cases.js';
import { createVendedorUseCases } from '../src/modules/vendedores/application/vendedor.use-cases.js';
import { createVentaUseCases } from '../src/modules/ventas/application/venta.use-cases.js';
import { NotFoundError, ValidationError } from '../src/shared/domain/errors.js';

test('los casos de uso validan sin depender de HTTP ni PostgreSQL', async () => {
  const stored = [];
  const repository = { async create(data) { stored.push(data); return { id: 1, ...data }; } };
  const productos = createProductoUseCases(repository);
  const product = await productos.create({ nombre: '  Filtro  ', precio: '25.50' });
  assert.equal(product.nombre, 'Filtro');
  assert.equal(product.descripcion, '');
  assert.throws(() => productos.create({ nombre: 'Filtro', precio: -1 }), ValidationError);

  const vendedores = createVendedorUseCases(repository);
  const seller = await vendedores.create({ nombre: ' Ana ', email: ' ANA@EXAMPLE.COM ' });
  assert.equal(seller.email, 'ana@example.com');

  const ventas = createVentaUseCases(repository);
  assert.throws(() => ventas.create({ producto_id: 1, vendedor_id: 1, cantidad: 1, precio_unitario: '10.00', fecha: '2026-02-30' }), ValidationError);
  assert.equal(stored.length, 2);
});

test('los casos de uso traducen ausencia de registros y validan IDs', async () => {
  const repository = {
    async find() { return undefined; },
    async update() { return undefined; },
    async remove() { return false; },
  };
  const productos = createProductoUseCases(repository);
  await assert.rejects(productos.find(1), NotFoundError);
  await assert.rejects(productos.update(1, { nombre: 'Filtro', precio: 10 }), NotFoundError);
  await assert.rejects(productos.remove(1), NotFoundError);
  await assert.rejects(productos.find(0), ValidationError);
});
