import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = new URL('../../../../database/migrations/', import.meta.url);
const checksum = (sql) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export async function migrate(pool) {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock(87241, 1)');
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const files = (await readdir(directory)).filter((name) => /^\d{3}-.+\.sql$/.test(name)).sort();
    const { rows: applied } = await client.query('SELECT nombre, checksum FROM schema_migrations');
    const known = new Map(applied.map((row) => [row.nombre, row.checksum]));
    if ([...known.keys()].some((name) => !files.includes(name))) throw new Error('Faltan archivos de migraciones que ya fueron aplicadas.');

    // Adopción de las versiones previas de este proyecto, que aún no tenían historial.
    if (!known.size) {
      const { rows } = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()");
      const has = (table, column) => rows.some((row) => row.table_name === table && row.column_name === column);
      const core = ['productos', 'vendedores', 'ventas'].filter((table) => has(table, 'id'));
      if (core.length && core.length !== 3) throw new Error('Esquema parcial: revisa las tablas antes de migrar.');
      const adopted = [];
      if (core.length) {
        adopted.push('000-base.sql');
        const states = [has('productos', 'activo'), has('vendedores', 'activo'), has('ventas', 'estado')];
        if (states.some(Boolean) && !states.every(Boolean)) throw new Error('Migración de estados parcial.');
        if (states.every(Boolean)) adopted.push('001-estados.sql');
        if (has('usuarios', 'id')) adopted.push('002-usuarios.sql');
        const roles = [has('usuarios', 'rol'), has('ventas', 'registrado_por')];
        if (roles.some(Boolean) && !roles.every(Boolean)) throw new Error('Migración de roles parcial.');
        if (roles.every(Boolean)) adopted.push('003-roles-y-autor-venta.sql');
        if (has('productos', 'stock')) throw new Error('Hay inventario sin historial de migraciones; revisa la adopción manual.');
      }
      await client.query('BEGIN');
      try {
        for (const file of adopted) {
          const hash = checksum(await readFile(new URL(file, directory), 'utf8'));
          await client.query('INSERT INTO schema_migrations(nombre, checksum) VALUES ($1, $2)', [file, hash]);
          known.set(file, hash);
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }

    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const hash = checksum(sql);
      if (known.has(file)) {
        if (known.get(file) !== hash) throw new Error(`La migración aplicada ${file} cambió. Crea una nueva migración.`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql.replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''));
        await client.query('INSERT INTO schema_migrations(nombre, checksum) VALUES ($1, $2)', [file, hash]);
        await client.query('COMMIT');
        console.log(`Migración aplicada: ${file}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(87241, 1)');
    client.release();
  }
}
