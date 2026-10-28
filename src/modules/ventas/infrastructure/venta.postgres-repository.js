import { createPostgresCrudRepository } from '../../../shared/infrastructure/database/postgres-crud-repository.js';

export function createVentaPostgresRepository(db) {
  return createPostgresCrudRepository(db, {
    table: 'ventas',
    columns: ['producto_id', 'vendedor_id', 'cantidad', 'precio_unitario', 'fecha', 'modificado_por'],
    patchColumns: ['producto_id', 'vendedor_id', 'cantidad', 'precio_unitario', 'fecha', 'modificado_por', 'estado', 'motivo_anulacion'],
    createColumns: ['producto_id', 'vendedor_id', 'cantidad', 'precio_unitario', 'fecha', 'registrado_por'],
  });
}
