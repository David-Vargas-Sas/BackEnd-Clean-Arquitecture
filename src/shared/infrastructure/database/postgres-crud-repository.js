import { translatePostgresError } from './postgres-error.js';
import { listWhere } from './list-filters.js';

// table y columns solo se configuran desde los adaptadores de cada módulo.
export function createPostgresCrudRepository(db, { table, columns, createColumns = columns, patchColumns = [...columns, table === 'ventas' ? 'estado' : 'activo'] }) {
  const identifier = /^[a-z_]+$/;
  if (!identifier.test(table) || !columns.length || [...columns, ...createColumns].some((column) => !identifier.test(column))) {
    throw new Error('Configuración SQL inválida.');
  }

  async function query(operation, sql, values) {
    try { return await db.query(sql, values); }
    catch (error) { throw translatePostgresError(error, operation); }
  }

  return {
    async list(limit, offset, filters = {}) {
      const values = [limit, offset];
      const where = listWhere(table, filters, values);
      const { rows } = await query('list', `SELECT * FROM ${table}${where} ORDER BY id LIMIT $1 OFFSET $2`, values);
      return rows;
    },
    async find(id) {
      const { rows } = await query('find', `SELECT * FROM ${table} WHERE id = $1`, [id]);
      return rows[0];
    },
    async create(data) {
      const placeholders = createColumns.map((_, index) => `$${index + 1}`);
      const { rows } = await query('create',
        `INSERT INTO ${table} (${createColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        createColumns.map((column) => data[column]));
      return rows[0];
    },
    async update(id, data) {
      const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
      const { rows } = await query('update',
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $${columns.length + 1} RETURNING *`,
        [...columns.map((column) => data[column]), id]);
      return rows[0];
    },
    async remove(id) {
      const { rowCount } = await query('remove', `DELETE FROM ${table} WHERE id = $1`, [id]);
      return rowCount > 0;
    },
    async patch(id, data) {
      const keys = Object.keys(data);
      if (!keys.length || keys.some((key) => !patchColumns.includes(key))) {
        throw new Error('Campos de actualización inválidos.');
      }
      const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
      const { rows } = await query('patch',
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...keys.map((key) => data[key]), id]);
      return rows[0];
    },
  };
}
