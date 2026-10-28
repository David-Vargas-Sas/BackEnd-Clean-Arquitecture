import { pool } from '../src/shared/infrastructure/database/pool.js';
import { migrate } from '../src/shared/infrastructure/database/migrator.js';

try {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL.');
  await migrate(pool);
  console.log('Base de datos al día.');
} catch (error) {
  console.error('Falló la migración:', error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
