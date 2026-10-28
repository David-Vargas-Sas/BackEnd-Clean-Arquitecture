const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const integer = { type: 'integer', minimum: 1, maximum: 2147483647 };
const money = { oneOf: [{ type: 'string', pattern: '^\\d{1,10}(\\.\\d{1,2})?$' }, { type: 'number', minimum: 0, maximum: 9999999999.99, multipleOf: 0.01 }] };
const object = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}) });
const roles = { type: 'string', enum: ['ADMIN', 'VENDEDOR', 'INVENTARIO'] };
const product = { nombre: { type: 'string', minLength: 1, maxLength: 120 }, descripcion: { type: 'string', maxLength: 500 }, precio: money };
const seller = { nombre: { type: 'string', minLength: 1, maxLength: 120 }, email: { type: 'string', format: 'email', maxLength: 254 } };
const sale = { producto_id: integer, vendedor_id: integer, cantidad: integer, precio_unitario: money, fecha: { type: 'string', format: 'date' } };
const password = { type: 'string', minLength: 12, maxLength: 128, writeOnly: true };
const profile = { id: integer, ...seller, rol: roles };
const user = { ...seller, password, rol: roles };
const headers = { 'X-Request-Id': { description: 'Identificador generado por el servidor.', schema: { type: 'string', format: 'uuid' } } };
const json = (schema) => ({ 'application/json': { schema } });
const response = (schema, description = 'Operación exitosa') => ({ description, headers, content: json(schema) });
const data = (schema) => object({ data: schema }, ['data']);
const error = (description) => response(ref('Error'), description);
const errors = {
  400: error('Datos o JSON inválidos'), 401: { ...error('No autenticado'), headers: { ...headers, 'WWW-Authenticate': { schema: { type: 'string' }, description: 'Bearer' } } },
  403: error('No tiene permiso'), 404: error('Registro inexistente'), 409: error('Conflicto de datos, estado, stock o concurrencia'),
  413: error('Cuerpo mayor de 32 KB'), 415: error('Se requiere application/json'), 500: error('Error interno sin detalles sensibles'),
};
const pagination = [
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 2147483647, default: 0 } },
];
const idParameter = { name: 'id', in: 'path', required: true, schema: integer };
const queryParameter = (name, schema) => ({ name, in: 'query', schema });
const catalogFilters = [queryParameter('q', { type: 'string', maxLength: 120 }), queryParameter('activo', { type: 'string', enum: ['true', 'false'] })];
const saleFilters = [queryParameter('desde', { type: 'string', format: 'date' }), queryParameter('hasta', { type: 'string', format: 'date' }), queryParameter('producto_id', integer), queryParameter('vendedor_id', integer), queryParameter('estado', { type: 'string', enum: ['REGISTRADA', 'ANULADA'] })];
const listData = (schema) => object({ data: { type: 'array', items: schema }, pagination: object({ limit: { type: 'integer' }, offset: { type: 'integer' } }, ['limit', 'offset']) }, ['data', 'pagination']);
const body = (schema) => ({ required: true, content: json(schema) });
const operation = (tag, summary, schema, status = 200) => ({ tags: [tag], summary, responses: { [status]: response(data(schema)), ...errors } });

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'API de ventas e inventario', version: '1.1.0', description: 'JWT Bearer y permisos por operación. Los importes de respuesta son cadenas decimales. Las ventas no se eliminan: se anulan con motivo. El stock se cambia mediante movimientos.' },
  servers: [{ url: '/' }],
  security: [{ bearerAuth: [] }],
  tags: ['Auth', 'Productos', 'Vendedores', 'Ventas', 'Inventario', 'Usuarios', 'Auditoria', 'Health'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: object({ error: object({ code: { type: 'string', example: 'CONFLICT' }, message: { type: 'string' }, requestId: { type: 'string', format: 'uuid' } }, ['code', 'message', 'requestId']) }, ['error']),
      ProductoInput: object(product, ['nombre', 'precio']),
      ProductoPatch: { ...object({ ...product, activo: { type: 'boolean' } }), minProperties: 1 },
      Producto: object({ id: integer, ...product, precio: { type: 'string' }, activo: { type: 'boolean' }, stock: { type: 'integer', minimum: 0 } }, ['id', 'nombre', 'precio', 'stock', 'activo', 'descripcion']),
      VendedorInput: object(seller, ['nombre', 'email']),
      VendedorPatch: { ...object({ ...seller, activo: { type: 'boolean' } }), minProperties: 1 },
      Vendedor: object({ id: integer, ...seller, activo: { type: 'boolean' } }, ['id', 'nombre', 'email', 'activo']),
      VentaInput: object(sale, Object.keys(sale)),
      VentaPatch: { oneOf: [
        { ...object(sale), minProperties: 1 },
        object({ estado: { type: 'string', enum: ['ANULADA'] }, motivo_anulacion: { type: 'string', minLength: 1, maxLength: 500 } }, ['estado', 'motivo_anulacion']),
      ] },
      Venta: object({ id: integer, ...sale, precio_unitario: { type: 'string' }, fecha: { type: 'string', description: 'Fecha ISO devuelta por PostgreSQL.' },
        total: { type: 'string' }, estado: { type: 'string', enum: ['REGISTRADA', 'ANULADA'] }, registrado_por: { ...integer, nullable: true },
        modificado_por: { ...integer, nullable: true }, motivo_anulacion: { type: 'string', nullable: true }, actualizada_en: { type: 'string', format: 'date-time' }, inventario_aplicado: { type: 'boolean' } },
      ['id', ...Object.keys(sale), 'total', 'estado', 'registrado_por', 'modificado_por', 'motivo_anulacion', 'actualizada_en', 'inventario_aplicado']),
      Login: object({ email: seller.email, password: { type: 'string', minLength: 1, maxLength: 128, writeOnly: true } }, ['email', 'password']),
      Perfil: object({ ...profile, permisos: { type: 'array', items: { type: 'string' }, example: ['ventas:read', 'ventas:create'] } }, ['id', 'nombre', 'email', 'rol', 'permisos']),
      Sesion: object({ accessToken: { type: 'string' }, tokenType: { type: 'string', enum: ['Bearer'] }, expiresIn: { type: 'integer', example: 900 }, user: ref('Perfil') }, ['accessToken', 'tokenType', 'expiresIn', 'user']),
      UsuarioInput: object(user, ['nombre', 'email', 'password']),
      UsuarioPatch: { ...object({ ...user, activo: { type: 'boolean' } }), minProperties: 1 },
      Usuario: object({ ...profile, activo: { type: 'boolean' }, creado_en: { type: 'string', format: 'date-time' } }, ['id', 'nombre', 'email', 'rol', 'activo', 'creado_en']),
      MovimientoInput: object({ producto_id: integer, tipo: { type: 'string', enum: ['ENTRADA', 'SALIDA'] }, cantidad: integer, motivo: { type: 'string', minLength: 1, maxLength: 500 } }, ['producto_id', 'tipo', 'cantidad', 'motivo']),
      Movimiento: object({ id: integer, producto_id: integer, tipo: { type: 'string', enum: ['ENTRADA', 'SALIDA', 'VENTA', 'ANULACION', 'AJUSTE_VENTA'] },
        cantidad: { type: 'integer', description: 'Variación con signo: positiva para entrada, negativa para salida.' }, stock_resultante: { type: 'integer', minimum: 0 },
        venta_id: { ...integer, nullable: true }, registrado_por: { ...integer, nullable: true }, motivo: { type: 'string' }, creado_en: { type: 'string', format: 'date-time' } }),
      Auditoria: object({ id: integer, entidad: { type: 'string', enum: ['ventas', 'usuarios'] }, registro_id: integer, accion: { type: 'string' }, usuario_id: { ...integer, nullable: true },
        antes: { type: 'object', additionalProperties: true, nullable: true }, despues: { type: 'object', additionalProperties: true }, creado_en: { type: 'string', format: 'date-time' } }),
    },
  },
  paths: {},
};

for (const [resource, tag, schema, input, patch, description] of [
  ['productos', 'Productos', 'Producto', 'ProductoInput', 'ProductoPatch', 'Lectura: todos los roles. Escritura: ADMIN e INVENTARIO. Eliminación: ADMIN, si no existe historial.'],
  ['vendedores', 'Vendedores', 'Vendedor', 'VendedorInput', 'VendedorPatch', 'Lectura: ADMIN y VENDEDOR. Escritura: ADMIN.'],
  ['ventas', 'Ventas', 'Venta', 'VentaInput', 'VentaPatch', 'Lectura y registro: ADMIN y VENDEDOR. Edición y anulación: ADMIN. Sin eliminación física.'],
]) {
  const base = `/api/${resource}`;
  openapi.paths[base] = {
    get: { ...operation(tag, `Listar ${resource}`, ref(schema)), description, parameters: [...pagination, ...(resource === 'ventas' ? saleFilters : catalogFilters)], responses: { 200: response(listData(ref(schema))), ...errors } },
    post: { ...operation(tag, `Crear ${schema.toLowerCase()}`, ref(schema), 201), description, requestBody: body(ref(input)) },
  };
  openapi.paths[`${base}/{id}`] = {
    parameters: [idParameter],
    get: { ...operation(tag, `Consultar ${schema.toLowerCase()}`, ref(schema)), description },
    put: { ...operation(tag, `Reemplazar datos de ${schema.toLowerCase()}`, ref(schema)), description, requestBody: body(ref(input)) },
    patch: { ...operation(tag, `Actualizar parcialmente ${schema.toLowerCase()}`, ref(schema)), description, requestBody: body(ref(patch)) },
    delete: resource === 'ventas'
      ? { tags: [tag], summary: 'Operación no permitida: use anulación', responses: { 405: { ...error('Historial protegido'), headers: { ...headers, Allow: { schema: { type: 'string', example: 'GET, HEAD, PUT, PATCH' } } } }, 401: errors[401] } }
      : { tags: [tag], summary: 'Eliminar registro sin historial', description, responses: { 204: { description: 'Eliminado sin cuerpo', headers }, ...errors } },
  };
}
openapi.paths['/api/auth/login'] = { post: { ...operation('Auth', 'Iniciar sesión', ref('Sesion')), security: [], requestBody: body(ref('Login')),
  responses: { 200: response(data(ref('Sesion'))), 400: errors[400], 401: errors[401], 413: errors[413], 415: errors[415], 429: { ...error('Diez peticiones por IP en quince minutos'), headers: { ...headers, 'Retry-After': { schema: { type: 'string' } } } }, 500: errors[500] } } };
openapi.paths['/api/auth/me'] = { get: operation('Auth', 'Consultar identidad y permisos efectivos', ref('Perfil')) };
openapi.paths['/api/health'] = { get: { tags: ['Health'], summary: 'Comprobar conexión PostgreSQL', security: [], responses: { 200: response(object({ status: { type: 'string', enum: ['ok'] } }, ['status'])), 500: errors[500] } } };
openapi.paths['/api/inventario/movimientos'] = {
  get: { tags: ['Inventario'], summary: 'Consultar movimientos (ADMIN, INVENTARIO)', parameters: [...pagination, { name: 'producto_id', in: 'query', schema: integer }], responses: { 200: response(listData(ref('Movimiento'))), ...errors } },
  post: { ...operation('Inventario', 'Registrar entrada o salida (ADMIN, INVENTARIO)', ref('Movimiento'), 201), requestBody: body(ref('MovimientoInput')) },
};
openapi.paths['/api/usuarios'] = {
  get: { tags: ['Usuarios'], summary: 'Listar usuarios (ADMIN)', parameters: [...pagination, ...catalogFilters, queryParameter('rol', roles)], responses: { 200: response(listData(ref('Usuario'))), ...errors } },
  post: { ...operation('Usuarios', 'Crear usuario (ADMIN)', ref('Usuario'), 201), requestBody: body(ref('UsuarioInput')) },
};
openapi.paths['/api/usuarios/{id}'] = { parameters: [idParameter],
  get: operation('Usuarios', 'Consultar usuario (ADMIN)', ref('Usuario')),
  patch: { ...operation('Usuarios', 'Cambiar datos, rol, estado o contraseña (ADMIN)', ref('Usuario')), description: 'Cambiar password invalida los tokens anteriores. No se puede desactivar ni degradar al último ADMIN activo.', requestBody: body(ref('UsuarioPatch')) },
};
openapi.paths['/api/auditoria'] = { get: { tags: ['Auditoria'], summary: 'Consultar historial de ventas y usuarios (ADMIN)',
  parameters: [...pagination, { name: 'entidad', in: 'query', schema: { type: 'string', enum: ['ventas', 'usuarios'] } }, { name: 'registro_id', in: 'query', schema: integer }],
  responses: { 200: response(listData(ref('Auditoria'))), ...errors },
} };
