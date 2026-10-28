import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
const target = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(target.pathname.slice(1));
if (!/^[a-z][a-z0-9_]*$/.test(database)) throw new Error('Nombre de base inválido.');
const adminUrl = new URL(target);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
try {
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!existing.rowCount) {
    await admin.query(`CREATE DATABASE "${database}"`);
    console.log(`Base ${database} creada.`);
  } else {
    console.log(`Base ${database} ya existe; no se reemplazó.`);
  }
} catch (error) {
  console.error('No se pudo preparar PostgreSQL:', error.code || 'CONNECTION_ERROR');
  process.exitCode = 1;
} finally {
  await admin.end();
}
