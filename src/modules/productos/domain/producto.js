import { text, money, validateFields } from '../../../shared/domain/validation.js';
import { partialInput, activeState } from '../../../shared/domain/partial-input.js';

export function validateProductoPatch(input) {
  return partialInput(input, validateProducto, { nombre: 'Producto', descripcion: '', precio: '0' }, 'activo', activeState);
}

export function validateProducto(input) {
  validateFields(input, ["nombre","descripcion","precio"]);
  return {
    nombre: text(input.nombre, 'nombre', 120),
    descripcion: input.descripcion === undefined || input.descripcion === '' ? '' : text(input.descripcion, 'descripcion', 500),
    precio: money(input.precio, 'precio'),
  };
}
