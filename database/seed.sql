BEGIN;
INSERT INTO productos(nombre, descripcion, precio) VALUES
('Filtro de aceite', 'Filtro para motor', 25000),
('Aceite de motor', 'Aceite de un litro', 45000),
('Pastillas de freno', 'Juego delantero', 120000),
('Bujía', 'Bujía de encendido', 18000),
('Limpiaparabrisas', 'Juego de plumillas', 35000);
INSERT INTO vendedores(nombre, email) VALUES
('Ana Pérez', 'ana@example.com'),
('Luis Gómez', 'luis@example.com'),
('María López', 'maria@example.com'),
('Carlos Díaz', 'carlos@example.com'),
('Laura Ruiz', 'laura@example.com');
INSERT INTO movimientos_inventario(producto_id, tipo, cantidad, stock_resultante, motivo)
SELECT id, 'ENTRADA', 100, 0, 'Existencias de ejemplo' FROM productos;
INSERT INTO ventas(producto_id, vendedor_id, cantidad, precio_unitario, fecha) VALUES
(1, 1, 2, 25000, '2026-10-01'),
(2, 2, 3, 45000, '2026-10-02'),
(3, 3, 1, 120000, '2026-10-03'),
(4, 4, 4, 18000, '2026-10-04'),
(5, 5, 1, 35000, '2026-10-05');
COMMIT;
