BEGIN;
CREATE TABLE productos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion VARCHAR(500) NOT NULL DEFAULT '',
  precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0)
);
CREATE TABLE vendedores (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email))
);
CREATE TABLE ventas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  fecha DATE NOT NULL,
  total NUMERIC(22,2) GENERATED ALWAYS AS (cantidad::numeric * precio_unitario) STORED
);
CREATE INDEX ventas_producto_idx ON ventas(producto_id);
CREATE INDEX ventas_vendedor_idx ON ventas(vendedor_id);
COMMIT;
