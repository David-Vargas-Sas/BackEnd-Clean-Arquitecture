# Autos · Backend

API para gestionar productos, vendedores, ventas e inventario. También maneja el inicio de sesión, los permisos de cada usuario y el historial de cambios de ventas y cuentas.

Está hecha con **Node.js 20, Express 5 y PostgreSQL**. La interfaz está en el proyecto `FrontEnd-Autos`; esta API también se puede probar por separado desde Swagger.

## Antes de empezar

Necesitas Node.js 20 con npm y PostgreSQL instalado y en ejecución. Comprueba Node con `node --version`.

Los comandos de esta guía usan PowerShell en Windows. En otras terminales puedes usar `npm` en lugar de `npm.cmd`.

## Preparar el proyecto

Desde la carpeta del backend:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Si ya tienes un `.env`, conserva el tuyo. Abre el archivo y ajusta estas variables:

| Variable | Para qué se usa |
| --- | --- |
| `PORT` | Puerto de la API. Por defecto, `3000`. |
| `DATABASE_URL` | Conexión a PostgreSQL: usuario, contraseña, servidor, puerto y base. |
| `CORS_ORIGIN` | Origen del frontend permitido cuando se accede a la API desde otro origen. |
| `JWT_SECRET` | Secreto para firmar los tokens. Debe tener al menos 32 bytes. |

La conexión tiene el formato `postgresql://USUARIO:CONTRASEÑA@localhost:5432/NOMBRE_BASE`. Los caracteres reservados de una URL que formen parte de la contraseña deben codificarse.

Para generar un secreto:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copia el resultado en `JWT_SECRET`. Sustituye los marcadores `CAMBIAR` del ejemplo. El `.env` es local y no debe subirse al repositorio.

### Base nueva

```powershell
node --env-file=.env scripts/prepare-local-db.js
npm.cmd run db:setup
```

El primer comando crea la base indicada en `DATABASE_URL` si no existe. Necesita un usuario de PostgreSQL con permiso para crear bases; también puedes crearla desde pgAdmin y ejecutar solo el segundo comando.

`db:setup` aplica las migraciones y carga cinco productos, cinco vendedores y cinco ventas de ejemplo. Primero registra una entrada de 100 unidades por producto para que las ventas tengan stock. No crea cuentas de acceso.

La carga es para una base vacía. Si ya hay productos, el script evita duplicarlos y pide usar las migraciones.

### Base existente

```powershell
npm.cmd run db:migrate
```

Aplica las migraciones pendientes y conserva los datos. No ejecutes los SQL uno por uno si usas este comando. Las versiones aplicadas se registran en `schema_migrations`; para otro cambio, crea una nueva migración en lugar de modificar una ya ejecutada.

## Crear el primer administrador

En una instalación nueva, añade temporalmente al `.env` estos datos y reemplázalos por los de tu cuenta:

```dotenv
NEW_USER_NAME=Administrador
NEW_USER_EMAIL=admin@example.com
NEW_USER_PASSWORD=REEMPLAZAR_CON_UNA_CONTRASEÑA_PROPIA
NEW_USER_ROLE=ADMIN
```

La contraseña debe tener entre 12 y 128 caracteres. Luego ejecuta:

```powershell
npm.cmd run auth:create-user
```

Retira las cuatro variables `NEW_USER_*` al terminar. Si ya tienes una cuenta, puedes usarla directamente. Para crear más usuarios, entra al frontend como administrador y abre **Usuarios**. Las cuentas creadas en un equipo no se generan automáticamente en otra instalación.

La contraseña de PostgreSQL y las contraseñas para entrar a Autos son distintas. Las de Autos se guardan con scrypt y una sal aleatoria; las respuestas no incluyen contraseñas ni hashes.

## Ejecutar y probar la API

```powershell
npm.cmd run dev
```

El modo de desarrollo reinicia el servidor cuando cambia el código. Para iniciarlo sin ese seguimiento, usa `npm.cmd start`.

Con el puerto por defecto:

| Dirección | Contenido |
| --- | --- |
| http://127.0.0.1:3000/api/health | Comprueba que PostgreSQL responde. |
| http://127.0.0.1:3000/api/docs/ | Swagger UI para consultar y probar las operaciones. |
| http://127.0.0.1:3000/api/openapi.json | Documento OpenAPI. |

En Swagger, ejecuta `POST /api/auth/login` con una cuenta creada. Copia `data.accessToken`, pulsa **Authorize** y pega el token. Podrás probar las operaciones que permita ese rol. La autorización no se conserva al recargar Swagger.

## Permisos por rol

| Funcionalidad | Administrador | Vendedor | Inventario |
| --- | --- | --- | --- |
| Consultar productos | Sí | Sí | Sí |
| Crear, editar y activar/desactivar productos | Sí | No | Sí |
| Eliminar productos sin historial | Sí | No | No |
| Consultar vendedores | Sí | Sí | No |
| Administrar vendedores | Sí | No | No |
| Consultar y registrar ventas | Sí | Sí | No |
| Editar o anular ventas | Sí | No | No |
| Consultar y registrar movimientos | Sí | No | Sí |
| Administrar usuarios y consultar auditoría | Sí | No | No |

Los usuarios de acceso y los vendedores comerciales son entidades distintas. El rol Vendedor puede consultar todas las ventas; no hay filtro por propietario. Ningún rol puede eliminar ventas físicamente.

Los permisos se definen en `src/modules/auth/domain/roles.js`. El frontend los usa para construir el menú y las acciones, pero el backend vuelve a verificarlos en cada petición.

## Ventas y stock

Cada venta contiene un producto, un vendedor, una cantidad, un precio por unidad y una fecha:

```json
{
  "producto_id": 1,
  "vendedor_id": 1,
  "cantidad": 2,
  "precio_unitario": "25000.00",
  "fecha": "2026-10-28"
}
```

El precio aplicado se conserva aunque después cambie el catálogo. PostgreSQL calcula el total. El autor se toma de la sesión; el cliente no puede enviarlo en el cuerpo.

- Crear una venta descuenta las unidades vendidas.
- Editar su cantidad ajusta la diferencia. Cambiar de producto devuelve unidades al anterior y descuenta del nuevo.
- Si falta stock o una referencia está inactiva, se rechaza la operación completa.
- Anular devuelve el stock aplicado y conserva la venta y el motivo. Solo puede hacerlo un administrador.

Para anular se usa `PATCH /api/ventas/:id` con `estado: "ANULADA"` y `motivo_anulacion`. Una venta anulada no se reactiva ni se edita. Repetir la anulación con el mismo motivo no devuelve stock otra vez.

Las entradas y salidas manuales se registran en `POST /api/inventario/movimientos`, con producto, tipo (`ENTRADA` o `SALIDA`), cantidad positiva y motivo. No se editan ni se borran movimientos: una corrección se registra con otro movimiento justificado.

Estas reglas se refuerzan con triggers y bloqueos de PostgreSQL. Venta, stock, movimientos y auditoría se confirman juntos o se revierten juntos. En instalaciones antiguas, las ventas con `inventario_aplicado=false` no devuelven unidades al anularse porque originalmente no las descontaron. Su primera edición descuenta la cantidad completa contra el stock actual.

## Endpoints y filtros

Swagger contiene los cuerpos y respuestas completos. Las rutas principales son:

| Ruta | Métodos |
| --- | --- |
| `/api/auth/login` | POST |
| `/api/auth/me` | GET |
| `/api/productos`, `/api/vendedores` | GET lista, POST |
| `/api/productos/:id`, `/api/vendedores/:id` | GET, PUT, PATCH, DELETE si no hay historial |
| `/api/ventas` | GET lista, POST |
| `/api/ventas/:id` | GET, PUT, PATCH; DELETE responde 405 |
| `/api/inventario/movimientos` | GET lista, POST |
| `/api/usuarios` | GET lista, POST |
| `/api/usuarios/:id` | GET, PATCH |
| `/api/auditoria` | GET lista |

Las rutas de negocio requieren `Authorization: Bearer TOKEN`. Las escrituras con cuerpo usan `Content-Type: application/json`. `PUT` recibe todos los campos editables; `PATCH`, solo los que cambian. Los campos desconocidos se rechazan.

Las listas usan `limit` (10 por defecto, máximo 100) y `offset` (0 por defecto). Los filtros se aplican en la base antes de paginar:

| Listado | Filtros |
| --- | --- |
| Productos y vendedores | `q` para buscar, `activo=true/false` |
| Usuarios | `q`, `activo`, `rol` |
| Ventas | `desde`, `hasta`, `producto_id`, `vendedor_id`, `estado` |
| Movimientos | `producto_id` |
| Auditoría | `entidad`, `registro_id` |

`q` admite hasta 120 caracteres. Las fechas usan `AAAA-MM-DD` y los extremos del rango se incluyen. Para avanzar diez registros, cambia `offset=0` por `offset=10`.

## Respuestas, sesión y errores

Consultas y escrituras devuelven `{ "data": ... }`. Las listas añaden `pagination`, sin un total general. Las creaciones devuelven 201 y `Location`; una eliminación permitida devuelve 204 sin cuerpo.

Los importes admiten números o cadenas decimales con hasta dos decimales. PostgreSQL los devuelve como cadenas para conservar la precisión. El stock es de solo lectura en productos y se modifica mediante ventas o movimientos.

Los errores siguen este formato:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Stock insuficiente o fuera de rango.",
    "requestId": "identificador-de-la-solicitud"
  }
}
```

| HTTP | Uso habitual |
| --- | --- |
| 400 | Datos o JSON inválidos. |
| 401 / 403 | Sesión inválida o permiso insuficiente. |
| 404 | Registro o ruta no encontrados. |
| 405 | Intento de eliminar una venta. |
| 409 | Conflicto de stock, estado o integridad. |
| 413 / 415 | Cuerpo demasiado grande o formato distinto de JSON. |
| 429 | Demasiados intentos de inicio de sesión. |
| 500 | Error interno con respuesta genérica. |

`requestId` también aparece en `X-Request-Id` y sirve para diagnóstico. El frontend presenta sus propios mensajes y no muestra esta referencia ni los detalles internos del error.

El JWT dura 15 minutos. Cada petición comprueba el estado y los permisos actuales de la cuenta. Desactivar un usuario impide usar sus tokens; cambiar su contraseña invalida los anteriores. No se puede desactivar ni quitar el rol al último administrador activo.

El login admite diez peticiones por IP cada quince minutos, incluidas las exitosas. El límite está en memoria por proceso. No hay registro público, recuperación por correo, refresh tokens ni revocación individual de sesiones; cerrar sesión en el frontend elimina su copia del token.

## Organización del código

```text
src/
  modules/
    auth/ productos/ vendedores/ ventas/ inventario/ usuarios/ auditoria/
  shared/
    domain/                    # Errores y validaciones comunes
    application/               # Casos de uso compartidos
    infrastructure/database/   # Conexión, repositorios y migrador
    presentation/http/         # Utilidades HTTP y errores
  docs/openapi.js
  app.js                       # Construye Express con dependencias inyectadas
  server.js                    # Comprueba la conexión e inicia el servidor
database/
  migrations/
  schema.sql
  seed.sql
scripts/
test/
```

Dentro de cada módulo se separan dominio, aplicación, infraestructura y presentación. Los controladores atienden HTTP, los casos de uso coordinan la operación y los repositorios ejecutan SQL parametrizado. Las garantías transaccionales de inventario dependen de PostgreSQL; cambiar de motor requeriría implementarlas en el nuevo adaptador.

`database/schema.sql` es una instantánea generada desde las migraciones. Para actualizarla usa `npm.cmd run db:schema`, no la edites a mano.

## Comprobar que funciona

| Comando | Qué comprueba |
| --- | --- |
| `npm.cmd test` | HTTP, permisos, validaciones, filtros y OpenAPI sin una base real. |
| `npm.cmd run db:verify` | Operaciones con PostgreSQL en una transacción que se revierte. Las secuencias pueden avanzar. |
| `npm.cmd run db:concurrency` | Migraciones y operaciones simultáneas sobre un esquema temporal. Necesita permiso `CREATE SCHEMA`. |
| `node --env-file=.env scripts/verify-list-filters.js` | Filtros con lecturas reales, sin escribir registros. |

La prueba de concurrencia comprueba, entre otros casos, dos ventas sobre la última unidad, anulaciones repetidas y la protección del último administrador. El esquema temporal se elimina al terminar. El flujo de GitHub Actions está en `.github/workflows/backend.yml`.

## Si algo falla al iniciar

- **No conecta a PostgreSQL:** comprueba que el servicio esté iniciado y que `DATABASE_URL` tenga el puerto, la base y las credenciales correctas.
- **Rechaza `JWT_SECRET`:** sustituye el marcador del ejemplo por un secreto aleatorio de al menos 32 bytes.
- **El login no acepta tu cuenta:** revisa que se creó en la base a la que apunta este `.env`. Los datos de ejemplo no incluyen usuarios.
- **No puedes vender:** revisa el estado del producto y del vendedor y registra una entrada si el stock es cero.

Para un despliegue, configura HTTPS, el origen permitido y los proxies reales. Si ejecutas varias instancias, el límite de login necesita almacenamiento compartido. La auditoría cubre ventas y administración de usuarios; los movimientos guardan su propio historial, pero no se auditan todavía los cambios de nombre o precio del catálogo.
