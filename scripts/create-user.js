import { pool } from '../src/shared/infrastructure/database/pool.js';
import { hashPassword } from '../src/modules/auth/infrastructure/password.service.js';
import { validateCredentials } from '../src/modules/auth/domain/credentials.js';
import { text } from '../src/shared/domain/validation.js';
import { validateRole } from '../src/modules/auth/domain/roles.js';

try {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en .env.');
  const nombre = text(process.env.NEW_USER_NAME, 'NEW_USER_NAME', 120);
  const { email, password } = validateCredentials({ email: process.env.NEW_USER_EMAIL, password: process.env.NEW_USER_PASSWORD });
  if (password.length < 12) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  const passwordHash = await hashPassword(password);
  const rol = validateRole(process.env.NEW_USER_ROLE || 'VENDEDOR');
  await pool.query('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)', [nombre, email, passwordHash, rol]);
  console.log('Usuario creado. Ya puedes iniciar sesión.');
} catch (error) {
  if (error.code === '23505') console.error('Ya existe un usuario con ese email.');
  else if (error.code) console.error('No se pudo crear el usuario. Revisa la conexión y la migración de usuarios.');
  else console.error(error.message);
  process.exitCode = 1;
} finally {
  delete process.env.NEW_USER_PASSWORD;
  await pool.end();
}
