-- Ejecutar UNA vez sobre una base existente creada antes de esta funcionalidad.
BEGIN;
ALTER TABLE productos ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE vendedores ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ventas ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'REGISTRADA'
  CHECK (estado IN ('REGISTRADA', 'ANULADA'));
CREATE OR REPLACE FUNCTION validar_estado_venta() RETURNS TRIGGER AS $$
DECLARE
  producto_activo BOOLEAN;
  vendedor_activo BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.estado = 'ANULADA' THEN
      IF ROW(NEW.producto_id, NEW.vendedor_id, NEW.cantidad, NEW.precio_unitario, NEW.fecha, NEW.estado)
         IS DISTINCT FROM
         ROW(OLD.producto_id, OLD.vendedor_id, OLD.cantidad, OLD.precio_unitario, OLD.fecha, OLD.estado) THEN
        RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Venta anulada';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.estado = 'ANULADA' THEN
      IF ROW(NEW.producto_id, NEW.vendedor_id, NEW.cantidad, NEW.precio_unitario, NEW.fecha)
         IS DISTINCT FROM ROW(OLD.producto_id, OLD.vendedor_id, OLD.cantidad, OLD.precio_unitario, OLD.fecha) THEN
        RAISE EXCEPTION USING ERRCODE = 'P1002', MESSAGE = 'Anular sin editar datos';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  -- Bloqueos compartidos: una desactivación concurrente espera al registro de la venta.
  SELECT activo INTO producto_activo FROM productos WHERE id = NEW.producto_id FOR SHARE;
  SELECT activo INTO vendedor_activo FROM vendedores WHERE id = NEW.vendedor_id FOR SHARE;
  IF producto_activo = FALSE OR vendedor_activo = FALSE THEN
    RAISE EXCEPTION USING ERRCODE = 'P1001', MESSAGE = 'Referencia inactiva';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ventas_validar_estado
BEFORE INSERT OR UPDATE ON ventas
FOR EACH ROW EXECUTE FUNCTION validar_estado_venta();

COMMIT;
