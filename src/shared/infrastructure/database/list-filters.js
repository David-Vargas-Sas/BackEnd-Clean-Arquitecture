import { ValidationError } from '../../domain/errors.js';

// Solo identificadores definidos aquí; los valores siempre se parametrizan.
export function listWhere(table, filters = {}, values = []) {
  const clauses = [];
  const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', '$' + values.length)); };
  const scalar = key => {
    const value = filters[key];
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') throw new ValidationError('Filtro inválido.');
    return value.trim();
  };
  if (['productos', 'vendedores', 'usuarios'].includes(table)) {
    const search = scalar('q');
    if (search) {
      if (search.length > 120) throw new ValidationError('La búsqueda admite hasta 120 caracteres.');
      add(table === 'productos' ? 'nombre ILIKE ?' : "(nombre || ' ' || email) ILIKE ?", '%' + search.replace(/[\\%_]/g, '\\$&') + '%');
    }
    const active = scalar('activo');
    if (active !== undefined) {
      if (!['true', 'false'].includes(active)) throw new ValidationError('Estado inválido.');
      add('activo = ?', active === 'true');
    }
  }
  if (table === 'usuarios') {
    const role = scalar('rol');
    if (role) {
      if (!['ADMIN', 'VENDEDOR', 'INVENTARIO'].includes(role)) throw new ValidationError('Rol inválido.');
      add('rol = ?', role);
    }
  }
  if (table === 'ventas') {
    for (const column of ['producto_id', 'vendedor_id']) {
      const value = scalar(column);
      if (value) {
        if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) throw new ValidationError('Filtro inválido.');
        add(column + ' = ?', Number(value));
      }
    }
    const state = scalar('estado');
    if (state) {
      if (!['REGISTRADA', 'ANULADA'].includes(state)) throw new ValidationError('Estado inválido.');
      add('estado = ?', state);
    }
    for (const [key, operator] of [['desde', '>='], ['hasta', '<=']]) {
      const value = scalar(key);
      if (value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ValidationError('Fecha inválida.');
        add('fecha ' + operator + ' ?', value);
      }
    }
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) throw new ValidationError('El inicio debe ser anterior al fin.');
  }
  return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
}
