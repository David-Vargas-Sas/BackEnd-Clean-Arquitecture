import { translatePostgresError } from '../../../shared/infrastructure/database/postgres-error.js';
import { listWhere } from '../../../shared/infrastructure/database/list-filters.js';

const publicColumns = 'id, nombre, email, rol, activo, creado_en';
export function createUsuarioRepository(db) {
  async function query(sql, values) {
    try { return await db.query(sql, values); }
    catch (error) { throw translatePostgresError(error, 'update'); }
  }
  return {
    async list({ limit, offset }, filters = {}) {
      const values = [limit, offset];
      const where = listWhere('usuarios', filters, values);
      return (await query(`SELECT ${publicColumns} FROM usuarios${where} ORDER BY id LIMIT $1 OFFSET $2`, values)).rows;
    },
    async find(id) {
      return (await query(`SELECT ${publicColumns} FROM usuarios WHERE id = $1`, [id])).rows[0];
    },
    async create(data) {
      return (await query(`INSERT INTO usuarios(nombre, email, rol, password_hash, modificado_por) VALUES ($1, $2, $3, $4, $5) RETURNING ${publicColumns}`,
        [data.nombre, data.email, data.rol, data.password_hash, data.modificado_por])).rows[0];
    },
    async patch(id, data) {
      const keys = Object.keys(data);
      const allowed = ['nombre', 'email', 'rol', 'activo', 'password_hash', 'modificado_por'];
      if (!keys.length || keys.some((key) => !allowed.includes(key))) throw new Error('Campos de usuario inválidos.');
      const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
      if (Object.hasOwn(data, 'password_hash')) assignments.push('token_version = token_version + 1');
      return (await query(`UPDATE usuarios SET ${assignments.join(', ')} WHERE id = $${keys.length + 1} RETURNING ${publicColumns}`,
        [...keys.map((key) => data[key]), id])).rows[0];
    },
  };
}
