# Autos — Backend

API REST para gestionar productos, vendedores, ventas e inventario, con autenticación, permisos por rol y auditoría. Desarrollada con **Node.js 20, Express 5 y PostgreSQL**.

## Requisitos

- Node.js 20 y npm.
- PostgreSQL en ejecución y una cuenta con acceso a la base del proyecto.

Los comandos usan PowerShell en Windows. En otras terminales, utiliza `npm` en lugar de `npm.cmd`.

## Instalación

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Si ya existe un `.env`, conserva su configuración. Completa estas variables antes de continuar:

| Variable | Configuración |
| --- | --- |
| `DATABASE_URL` | `postgresql://USUARIO:CONTRASEÑA@SERVIDOR:5432/BASE` |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 bytes. |
| `PORT` | Puerto de la API; por defecto, `3000`. |
| `CORS_ORIGIN` | Origen permitido para el frontend; por ejemplo, `http://127.0.0.1:4200`. |

El nombre de la base debe coincidir con el de PostgreSQL. Codifica los caracteres reservados de la contraseña si aparecen en la URL. No publiques el `.env`.

Para generar el secreto de JWT:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

### Base de datos

Para una instalación nueva:

```powershell
node --env-file=.env scripts/prepare-local-db.js
npm.cmd run db:setup
```

El primer comando crea la base configurada si no existe y requiere permiso para crear bases. Si la creas desde pgAdmin, ejecuta solo `db:setup`. Este aplica las migraciones y carga cinco productos, cinco vendedores y cinco ventas de ejemplo, con inventario inicial.

Para actualizar una base existente, sin repetir los ejemplos:

```powershell
npm.cmd run db:migrate
```

Las migraciones aplicadas no se editan: cada cambio de esquema debe ir en una nueva migración. El diagrama, la instalación manual con SQL y los datos de ejemplo están en [database/README.md](database/README.md).

### Cuenta de administrador

La carga de productos y ventas no crea usuarios. Para crear el primer administrador, añade temporalmente al `.env`:

```dotenv
NEW_USER_NAME=Administrador
NEW_USER_EMAIL=admin@example.com
NEW_USER_PASSWORD=REEMPLAZAR_CON_UNA_CONTRASEÑA_PROPIA
NEW_USER_ROLE=ADMIN
```

Reemplaza la contraseña por una propia de 12 a 128 caracteres y ejecuta:

```powershell
npm.cmd run auth:create-user
```

Retira las variables `NEW_USER_*` al terminar. Las demás cuentas se administran desde Usuarios en el frontend. Para preparar las cuentas locales de prueba existe el SQL opcional [seed-usuarios.sql](database/seed-usuarios.sql); no modifica cuentas existentes ni se ejecuta automáticamente.

## Ejecución y documentación de la API

```powershell
npm.cmd run dev
```

Para ejecutar sin reinicio automático, usa `npm.cmd start`.

| Recurso | Dirección local |
| --- | --- |
| Estado de conexión | http://127.0.0.1:3000/api/health |
| Swagger UI | http://127.0.0.1:3000/api/docs/ |
| OpenAPI | http://127.0.0.1:3000/api/openapi.json |

En Swagger, ejecuta `POST /api/auth/login`, copia `data.accessToken` y pégalo en **Authorize**. Las rutas de negocio requieren `Authorization: Bearer TOKEN`; las escrituras con cuerpo usan JSON. Swagger documenta endpoints, filtros, respuestas y errores.

## Funcionalidades y reglas principales

- **Productos y vendedores:** consulta, creación, edición, activación/desactivación y eliminación cuando no exista historial asociado.
- **Ventas:** un producto por venta, precio histórico, total calculado y ajuste de stock al crear o editar. La anulación requiere motivo y conserva el historial; no hay eliminación física.
- **Inventario:** entradas y salidas justificadas. Los movimientos no se editan ni se eliminan.
- **Usuarios:** gestión de cuentas, rol, estado y contraseña. Se protege al último administrador activo.
- **Auditoría:** consulta de cambios de ventas y usuarios. Los movimientos conservan su propio historial.

| Rol | Acceso |
| --- | --- |
| `ADMIN` | Todos los módulos; edición y anulación de ventas. |
| `VENDEDOR` | Consulta de productos y vendedores; consulta y registro de ventas. |
| `INVENTARIO` | Consulta y mantenimiento de productos; consulta y registro de movimientos. |

Los permisos se verifican en el servidor. Las contraseñas se almacenan con scrypt y el JWT dura 15 minutos. No hay registro público, recuperación por correo ni refresh tokens.

Los listados filtran y paginan en PostgreSQL con `limit` y `offset`, diez registros por defecto. Las reglas de stock usan transacciones y bloqueos de la base para impedir operaciones parciales o existencias negativas.

## Arquitectura

Monolito modular organizado por funcionalidad. Cada módulo separa dominio, aplicación, infraestructura y presentación HTTP. Los casos de uso reciben sus repositorios como dependencias; los controladores no ejecutan SQL.

```text
src/modules/   # auth, productos, vendedores, ventas, inventario, usuarios, auditoria
src/shared/    # Validaciones, CRUD, conexión y utilidades HTTP
src/docs/      # Contrato OpenAPI
database/      # Migraciones, esquema y datos de ejemplo
scripts/       # Instalación y verificaciones
test/          # Pruebas de API y casos de uso
```

El acceso a datos usa SQL parametrizado, sin ORM. Las reglas transaccionales de stock e historial también se refuerzan con triggers de PostgreSQL.

## Pruebas y mantenimiento

| Comando | Propósito |
| --- | --- |
| `npm.cmd test` | Pruebas de API, permisos y validaciones sin PostgreSQL real. |
| `npm.cmd run test:coverage` | Pruebas con informe de cobertura JavaScript en terminal. |
| `npm.cmd run db:verify` | Verificación con PostgreSQL y rollback; las secuencias pueden avanzar. |
| `npm.cmd run db:concurrency` | Pruebas de concurrencia en un esquema temporal; requiere permiso para crearlo. |
| `npm.cmd run db:schema` | Regenera `database/schema.sql` desde las migraciones. |

El alcance de cobertura está en [docs/COBERTURA.md](docs/COBERTURA.md). No incluye los triggers SQL. El workflow de verificación del backend está en `.github/workflows/backend.yml`.
