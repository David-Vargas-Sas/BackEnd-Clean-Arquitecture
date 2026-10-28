export function createUsuarioPostgresRepository(db) {
  return {
    async findByEmail(email) {
      const { rows } = await db.query(
        'SELECT id, nombre, email, rol, password_hash, activo, token_version FROM usuarios WHERE email = $1', [email]);
      return rows[0];
    },
    async findById(id) {
      const { rows } = await db.query('SELECT id, nombre, email, rol, activo, token_version FROM usuarios WHERE id = $1', [id]);
      return rows[0];
    },
  };
}
