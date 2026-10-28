BEGIN;
ALTER TABLE productos ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);
ALTER TABLE usuarios ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN modificado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE ventas ADD COLUMN modificado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE ventas ADD COLUMN motivo_anulacion VARCHAR(500);
ALTER TABLE ventas ADD COLUMN actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Las ventas históricas no redujeron stock: nunca devolver existencias inventadas.
ALTER TABLE ventas ADD COLUMN inventario_aplicado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ventas ALTER COLUMN inventario_aplicado SET DEFAULT TRUE;

CREATE TABLE movimientos_inventario (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'VENTA', 'ANULACION', 'AJUSTE_VENTA')),
  cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
  stock_resultante INTEGER NOT NULL CHECK (stock_resultante >= 0),
  venta_id INTEGER REFERENCES ventas(id) ON DELETE RESTRICT,
  registrado_por INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  motivo VARCHAR(500) NOT NULL CHECK (length(trim(motivo)) > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((tipo IN ('ENTRADA', 'ANULACION') AND cantidad > 0)
    OR (tipo IN ('SALIDA', 'VENTA') AND cantidad < 0) OR tipo = 'AJUSTE_VENTA'),
  CHECK ((tipo IN ('ENTRADA', 'SALIDA') AND venta_id IS NULL)
    OR (tipo NOT IN ('ENTRADA', 'SALIDA') AND venta_id IS NOT NULL))
);
CREATE INDEX movimientos_producto_idx ON movimientos_inventario(producto_id, id);
CREATE INDEX movimientos_venta_idx ON movimientos_inventario(venta_id);

CREATE TABLE auditoria (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad VARCHAR(30) NOT NULL,
  registro_id INTEGER NOT NULL,
  accion VARCHAR(30) NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  antes JSONB,
  despues JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auditoria_registro_idx ON auditoria(entidad, registro_id, id);

CREATE FUNCTION movimiento_manual_stock() RETURNS TRIGGER AS $$
DECLARE disponible INTEGER;
habilitado BOOLEAN;
BEGIN
  SELECT stock, activo INTO disponible, habilitado FROM productos WHERE id = NEW.producto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Producto inexistente'; END IF;
  IF NEW.tipo IN ('ENTRADA', 'SALIDA') THEN
    IF NOT habilitado THEN RAISE EXCEPTION USING ERRCODE = 'P1001', MESSAGE = 'Producto inactivo'; END IF;
    IF disponible::bigint + NEW.cantidad < 0 OR disponible::bigint + NEW.cantidad > 2147483647 THEN
      RAISE EXCEPTION USING ERRCODE = 'P1003', MESSAGE = 'Stock insuficiente';
    END IF;
    UPDATE productos SET stock = stock + NEW.cantidad WHERE id = NEW.producto_id RETURNING stock INTO disponible;
  END IF;
  NEW.stock_resultante := disponible;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER movimiento_manual BEFORE INSERT ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION movimiento_manual_stock();

CREATE FUNCTION aplicar_stock(pid INTEGER, delta INTEGER, clase TEXT, vid INTEGER, actor INTEGER, razon TEXT)
RETURNS VOID AS $$
BEGIN
  IF delta = 0 THEN RETURN; END IF;
  UPDATE productos SET stock = (stock::bigint + delta)::integer
    WHERE id = pid AND stock::bigint + delta BETWEEN 0 AND 2147483647;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P1003', MESSAGE = 'Stock insuficiente'; END IF;
  INSERT INTO movimientos_inventario(producto_id, tipo, cantidad, stock_resultante, venta_id, registrado_por, motivo)
    VALUES (pid, clase, delta, 0, vid, actor, razon);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validar_estado_venta() RETURNS TRIGGER AS $$
DECLARE anterior_producto INTEGER;
DECLARE producto_activo BOOLEAN;
DECLARE vendedor_activo BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    anterior_producto := OLD.producto_id;
    IF NEW.registrado_por IS DISTINCT FROM OLD.registrado_por THEN
      RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Autor inmutable';
    END IF;
    IF OLD.estado = 'ANULADA' THEN
      IF ROW(NEW.producto_id, NEW.vendedor_id, NEW.cantidad, NEW.precio_unitario, NEW.fecha, NEW.estado, NEW.motivo_anulacion)
        IS DISTINCT FROM ROW(OLD.producto_id, OLD.vendedor_id, OLD.cantidad, OLD.precio_unitario, OLD.fecha, OLD.estado, OLD.motivo_anulacion) THEN
        RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Venta anulada';
      END IF;
      NEW.modificado_por := OLD.modificado_por;
      NEW.actualizada_en := OLD.actualizada_en;
      RETURN NEW;
    END IF;
    IF NEW.estado = 'ANULADA' THEN
      IF NEW.motivo_anulacion IS NULL OR length(trim(NEW.motivo_anulacion)) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Motivo obligatorio';
      END IF;
      IF ROW(NEW.producto_id, NEW.vendedor_id, NEW.cantidad, NEW.precio_unitario, NEW.fecha)
        IS DISTINCT FROM ROW(OLD.producto_id, OLD.vendedor_id, OLD.cantidad, OLD.precio_unitario, OLD.fecha) THEN
        RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Anular sin editar datos';
      END IF;
      NEW.actualizada_en := clock_timestamp();
      NEW.inventario_aplicado := OLD.inventario_aplicado;
      RETURN NEW;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.estado <> 'REGISTRADA' THEN
    RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Estado inicial inválido';
  END IF;
  -- Todos los productos implicados se bloquean en el mismo orden.
  PERFORM id FROM productos WHERE id = ANY(ARRAY[NEW.producto_id, anterior_producto]) ORDER BY id FOR UPDATE;
  SELECT activo INTO producto_activo FROM productos WHERE id = NEW.producto_id;
  SELECT activo INTO vendedor_activo FROM vendedores WHERE id = NEW.vendedor_id FOR SHARE;
  IF producto_activo = FALSE OR vendedor_activo = FALSE THEN
    RAISE EXCEPTION USING ERRCODE = 'P1001', MESSAGE = 'Referencia inactiva';
  END IF;
  NEW.inventario_aplicado := TRUE;
  NEW.actualizada_en := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION venta_stock_auditoria() RETURNS TRIGGER AS $$
DECLARE actor INTEGER;
DECLARE anterior JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    actor := NEW.registrado_por;
    PERFORM aplicar_stock(NEW.producto_id, -NEW.cantidad, 'VENTA', NEW.id, actor, 'Registro de venta');
  ELSE
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    actor := NEW.modificado_por;
    anterior := to_jsonb(OLD);
    IF NEW.estado = 'ANULADA' THEN
      IF OLD.estado = 'REGISTRADA' AND OLD.inventario_aplicado THEN
        PERFORM aplicar_stock(OLD.producto_id, OLD.cantidad, 'ANULACION', NEW.id, actor, NEW.motivo_anulacion);
      END IF;
    ELSIF OLD.inventario_aplicado AND OLD.producto_id = NEW.producto_id THEN
      PERFORM aplicar_stock(NEW.producto_id, OLD.cantidad - NEW.cantidad, 'AJUSTE_VENTA', NEW.id, actor, 'Cambio de cantidad');
    ELSE
      IF OLD.inventario_aplicado THEN
        PERFORM aplicar_stock(OLD.producto_id, OLD.cantidad, 'AJUSTE_VENTA', NEW.id, actor, 'Cambio de producto');
      END IF;
      PERFORM aplicar_stock(NEW.producto_id, -NEW.cantidad, 'AJUSTE_VENTA', NEW.id, actor, 'Actualización de venta');
    END IF;
  END IF;
  INSERT INTO auditoria(entidad, registro_id, accion, usuario_id, antes, despues)
    VALUES ('ventas', NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'CREAR' WHEN NEW.estado = 'ANULADA' THEN 'ANULAR' ELSE 'EDITAR' END,
      actor, anterior, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER venta_stock AFTER INSERT OR UPDATE ON ventas FOR EACH ROW EXECUTE FUNCTION venta_stock_auditoria();

CREATE FUNCTION historial_inmutable() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P1004', MESSAGE = 'Historial inmutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER venta_no_eliminar BEFORE DELETE ON ventas FOR EACH ROW EXECUTE FUNCTION historial_inmutable();
CREATE TRIGGER movimientos_inmutables BEFORE UPDATE OR DELETE ON movimientos_inventario FOR EACH ROW EXECUTE FUNCTION historial_inmutable();
CREATE TRIGGER auditoria_inmutable BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION historial_inmutable();

CREATE FUNCTION proteger_ultimo_admin() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(87241, 2);
  IF OLD.rol = 'ADMIN' AND OLD.activo AND (NOT NEW.activo OR NEW.rol <> 'ADMIN') THEN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND activo AND id <> OLD.id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P1005', MESSAGE = 'Último administrador';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ultimo_admin BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION proteger_ultimo_admin();

CREATE FUNCTION auditar_usuario() RETURNS TRIGGER AS $$
DECLARE anterior JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    anterior := jsonb_build_object('nombre', OLD.nombre, 'email', OLD.email, 'rol', OLD.rol, 'activo', OLD.activo);
  END IF;
  INSERT INTO auditoria(entidad, registro_id, accion, usuario_id, antes, despues)
    VALUES ('usuarios', NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'CREAR' ELSE 'EDITAR' END, NEW.modificado_por,
      anterior, jsonb_build_object('nombre', NEW.nombre, 'email', NEW.email, 'rol', NEW.rol, 'activo', NEW.activo, 'token_version', NEW.token_version));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER usuario_auditoria AFTER INSERT OR UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION auditar_usuario();
COMMIT;
