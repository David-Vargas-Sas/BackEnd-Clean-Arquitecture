import { createPostgresCrudRepository } from '../../../shared/infrastructure/database/postgres-crud-repository.js';

export function createProductoPostgresRepository(db) {
  return createPostgresCrudRepository(db, {
    table: 'productos',
    columns: ["nombre","descripcion","precio"],
  });
}
