import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

pool.on('error', (error) => console.error('Error de conexión PostgreSQL:', error.message));
