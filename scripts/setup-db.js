import { readFile } from 'node:fs/promises';
import { pool } from '../src/shared/infrastructure/database/pool.js';
import { migrate } from '../src/shared/infrastructure/database/migrator.js';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
try {
  await migrate(pool);
  const { rows } = await pool.query('SELECT EXISTS (SELECT 1 FROM productos) AS populated');
  if (rows[0].populated) throw new Error('La base contiene productos. No se duplica la carga de ejemplo; usa db:migrate.');
  await pool.query(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'));
  console.log('Tablas creadas y cinco registros por tabla de negocio. Crea el primer usuario con npm run auth:create-user.');
} catch (error) {
  console.error('No se pudo preparar la base de datos:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
