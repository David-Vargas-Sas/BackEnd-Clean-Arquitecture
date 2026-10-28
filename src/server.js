import { pool } from './shared/infrastructure/database/pool.js';
import { createApp } from './app.js';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');

try {
  await pool.query('SELECT 1');
  const server = createApp(pool).listen(port, () => console.log(`API disponible en http://localhost:${port}/api`));
  server.on('error', async (error) => {
    console.error('No se pudo iniciar el servidor:', error.message);
    await pool.end();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => { await pool.end(); clearTimeout(timeout); });
  });
} catch (error) {
  console.error('No se pudo conectar a PostgreSQL:', error.message);
  await pool.end();
  process.exitCode = 1;
}
