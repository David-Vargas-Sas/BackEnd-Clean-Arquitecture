import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
const schema = `delivery_${randomBytes(10).toString('hex')}`;
assert.match(schema, /^delivery_[a-f0-9]{20}$/);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
// Los dos archivos son transaccionales. Se usa una sola transacción exterior para revertir la instalación completa.
const withoutTransaction = sql => sql.replace(/^(?:--[^\n]*\n)*\s*BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
try {
  await db.connect();
  await db.query('BEGIN');
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query(`SET LOCAL search_path TO "${schema}"`);
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = await readFile(new URL('../database/' + file, import.meta.url), 'utf8');
    await db.query(withoutTransaction(sql.replace(/\r\n/g, '\n')));
  }
  for (const table of ['productos', 'vendedores', 'ventas']) {
    const { rows: [row] } = await db.query(`SELECT count(*)::integer AS total FROM ${table}`);
    assert.equal(row.total, 5, 'Deben existir cinco registros en ' + table);
    console.log(table + ': 5 registros de ejemplo.');
  }
  const { rows: keys } = await db.query(`SELECT r.relname AS tabla, c.contype AS tipo, pg_get_constraintdef(c.oid) AS definicion
    FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
    WHERE r.relnamespace = $1::regnamespace AND r.relname IN ('productos', 'vendedores', 'ventas')`, [schema]);
  for (const table of ['productos', 'vendedores', 'ventas']) assert.ok(keys.some(key => key.tabla === table && key.tipo === 'p' && key.definicion === 'PRIMARY KEY (id)'));
  for (const [column, table] of [['producto_id', 'productos'], ['vendedor_id', 'vendedores']]) {
    assert.ok(keys.some(key => key.tabla === 'ventas' && key.tipo === 'f' && key.definicion === `FOREIGN KEY (${column}) REFERENCES ${table}(id) ON DELETE RESTRICT`));
  }
  const { rows: products } = await db.query('SELECT stock FROM productos ORDER BY id');
  assert.deepEqual(products.map(row => row.stock), [98, 97, 99, 96, 99]);
  const { rows: sales } = await db.query('SELECT total FROM ventas ORDER BY id');
  assert.deepEqual(sales.map(row => Number(row.total)), [50000, 135000, 120000, 72000, 35000]);
  console.log('Claves primarias, relaciones, totales y stock: correctos.');
} finally {
  try { await db.query('ROLLBACK'); } finally { await db.end(); }
}
console.log('Verificación terminada. Instalación temporal revertida.');
