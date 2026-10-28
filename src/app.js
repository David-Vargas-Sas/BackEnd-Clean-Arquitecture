import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProductoModule } from './modules/productos/index.js';
import { createVendedorModule } from './modules/vendedores/index.js';
import { createVentaModule } from './modules/ventas/index.js';
import { errorHandler } from './shared/presentation/http/error-handler.js';
import { requestContext } from './shared/presentation/http/request-context.js';
import { requireJson } from './shared/presentation/http/require-json.js';
import { NotFoundError } from './shared/domain/errors.js';
import { createAuthModule } from './modules/auth/index.js';
import { authorizeResource } from './modules/auth/presentation/authorize.middleware.js';
import { createInventarioModule } from './modules/inventario/index.js';
import { createUsuariosModule } from './modules/usuarios/index.js';
import { createAuditoriaModule } from './modules/auditoria/index.js';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './docs/openapi.js';

export function createApp(db, { authenticate: authenticateOverride, jwtConfig } = {}) {
  const app = express();
  const auth = createAuthModule(db, jwtConfig);
  const authenticate = authenticateOverride ?? auth.authenticate;
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet());
  app.get('/api/openapi.json', (req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { validatorUrl: null, persistAuthorization: false } }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    exposedHeaders: ['X-Request-Id', 'Location', 'WWW-Authenticate', 'Retry-After'],
  }));
  app.use(requireJson);
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', auth.routes);
  app.use('/api/productos', authenticate, authorizeResource('productos'), createProductoModule(db));
  app.use('/api/vendedores', authenticate, authorizeResource('vendedores'), createVendedorModule(db));
  app.use('/api/ventas', authenticate, authorizeResource('ventas'), createVentaModule(db));
  app.use('/api/inventario', authenticate, authorizeResource('inventario'), createInventarioModule(db));
  app.use('/api/usuarios', authenticate, authorizeResource('usuarios'), createUsuariosModule(db));
  app.use('/api/auditoria', authenticate, authorizeResource('auditoria'), createAuditoriaModule(db));
  app.use(() => { throw new NotFoundError('Ruta no encontrada.'); });
  app.use(errorHandler);
  return app;
}
