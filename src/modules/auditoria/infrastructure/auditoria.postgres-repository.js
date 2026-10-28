export function createAuditoriaRepository(db) {
  return {
    async list({ entidad, registroId, limit, offset }) {
      const { rows } = await db.query(
        'SELECT * FROM auditoria WHERE ($1::text IS NULL OR entidad = $1) AND ($2::integer IS NULL OR registro_id = $2) ORDER BY id DESC LIMIT $3 OFFSET $4',
        [entidad, registroId, limit, offset]);
      return rows;
    },
  };
}
