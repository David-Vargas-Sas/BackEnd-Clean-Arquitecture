import { createPostgresCrudRepository } from '../../../shared/infrastructure/database/postgres-crud-repository.js';

export function createVendedorPostgresRepository(db) {
  return createPostgresCrudRepository(db, {
    table: 'vendedores',
    columns: ["nombre","email"],
  });
}
