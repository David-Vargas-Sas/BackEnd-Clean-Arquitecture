-- Ejecutar una vez, después de 002-usuarios.sql, sobre una base existente.
BEGIN;
ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'VENDEDOR'
  CHECK (rol IN ('ADMIN', 'VENDEDOR', 'INVENTARIO'));
ALTER TABLE ventas ADD COLUMN registrado_por INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
CREATE INDEX ventas_registrado_por_idx ON ventas(registrado_por);
-- No se atribuye un autor inventado a ventas históricas: conservan NULL.
COMMIT;
