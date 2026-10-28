import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = new URL('../database/migrations/', import.meta.url);
const files = (await readdir(directory)).filter((file) => /^\d{3}-.+\.sql$/.test(file)).sort();
let result = '-- Generado por npm run db:schema. No editar: agrega una migración.\nBEGIN;\n';
const versions = [];
for (const file of files) {
  const sql = (await readFile(new URL(file, directory), 'utf8')).replace(/\r\n/g, '\n');
  result += `\n-- ${file}\n${sql.replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '').trim()}\n`;
  versions.push([file, createHash('sha256').update(sql).digest('hex')]);
}
result += '\nCREATE TABLE schema_migrations (nombre TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);\n';
for (const [file, hash] of versions) result += `INSERT INTO schema_migrations(nombre, checksum) VALUES ('${file}', '${hash}');\n`;
result += 'COMMIT;\n';
const destination = new URL('../database/schema.sql', import.meta.url);
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')).replace(/\r\n/g, '\n') !== result) throw new Error('Ejecuta npm run db:schema para actualizar la instantánea SQL.');
} else { await writeFile(destination, result, 'utf8'); }
