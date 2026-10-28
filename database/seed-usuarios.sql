-- Cuentas de prueba locales. No ejecutar en una base de produccion.
-- Ejecutar despues de schema.sql o de aplicar todas las migraciones.
-- Usa las credenciales de prueba ya acordadas; no contiene contrasenas en texto plano.
-- Repetirlo no cambia contrasenas, roles ni estados de cuentas existentes.
BEGIN;
INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES
('Administrador', 'admin@example.com', 'scrypt-v1$f78f847e6adad4c4af04a185ad0c4b42$cc3f9fb35a80a19f7f7dec0961bf8da27de7997ed56b459b417f77f2739b618b70923a8892468ebf806eb596780b2789171338c3a6779e710c36a7a6efb4f4c1', 'ADMIN', TRUE),
('Ventas Demo', 'ventas@example.com', 'scrypt-v1$d2d831f8633bec035dfb18e5ee548904$e8974b985b9dc0b7566cc41926e5ee5ccdba69c7c4cc49959be95c0857b8cffee9f4b322c8d62ebe80a58b65362dcbed2e6042de5327b45e1932afcd3e2fd422', 'VENDEDOR', TRUE),
('Inventario Demo', 'inventario@example.com', 'scrypt-v1$55c358bf4753822d99c53619ed46b886$3ae12eb3cce4f59860a2e1d19250a687ce300d9f0f358aeea22d8566a1997728c416aff55bb60ea83a64e627d51bbbe5c4e84de2f42c6965af1e00d72edab19d', 'INVENTARIO', TRUE)
ON CONFLICT (email) DO NOTHING;
COMMIT;

-- Comprobar las cuentas sin mostrar sus hashes.
SELECT nombre, email, rol, activo
FROM usuarios
WHERE email IN ('admin@example.com', 'ventas@example.com', 'inventario@example.com')
ORDER BY email;
