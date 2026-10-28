import { translatePostgresError } from '../../../shared/infrastructure/database/postgres-error.js';

export function createInventarioRepository(db) {
  return {
    async list({ limit, offset }, productoId) {
      const { rows } = await db.query(
        'SELECT * FROM movimientos_inventario WHERE ($1::integer IS NULL OR producto_id = $1) ORDER BY id DESC LIMIT $2 OFFSET $3',
        [productoId ?? null, limit, offset]);
      return rows;
    },
    async create(data) {
      try {
        const { rows } = await db.query(
          'INSERT INTO movimientos_inventario(producto_id, tipo, cantidad, stock_resultante, registrado_por, motivo) VALUES ($1, $2, $3, 0, $4, $5) RETURNING *',
          [data.producto_id, data.tipo, data.cantidad, data.registrado_por, data.motivo]);
        return rows[0];
      } catch (error) { throw translatePostgresError(error, 'create'); }
    },
  };
}
