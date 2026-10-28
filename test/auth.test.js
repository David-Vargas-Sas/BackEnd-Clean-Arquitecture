import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { jwtConfig } from '../test-support/create-app.js';
import { hashPassword, verifyPassword } from '../src/modules/auth/infrastructure/password.service.js';
import { createJwtService, readJwtConfig } from '../src/modules/auth/infrastructure/jwt.service.js';

const password = 'Clave de prueba larga 123!';
const passwordHash = await hashPassword(password);
const user = { id: 1, nombre: 'Ana', email: 'ana@example.com', rol: 'ADMIN', password_hash: passwordHash, activo: true };

function fixture(currentUser = user) {
  const calls = [];
  const db = { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('FROM usuarios')) return { rows: currentUser ? [currentUser] : [] };
    return { rows: [], rowCount: 0 };
  } };
  return { app: createApp(db, { jwtConfig }), calls };
}

test('login real emite un JWT y permite acceder a me y al CRUD sin filtrar hashes', async () => {
  const { app, calls } = fixture();
  const response = await request(app).post('/api/auth/login').send({ email: ' ANA@EXAMPLE.COM ', password }).expect(200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.data.tokenType, 'Bearer');
  assert.equal(response.body.data.expiresIn, 900);
  const { permisos, ...profile } = response.body.data.user;
  assert.deepEqual(profile, { id: 1, nombre: 'Ana', email: 'ana@example.com', rol: 'ADMIN' });
  assert.ok(permisos.includes('usuarios:create'));
  assert.ok(!permisos.includes('ventas:delete'));
  assert.ok(!response.text.includes('password_hash'));
  assert.deepEqual(calls[0].values, ['ana@example.com']);
  const token = response.body.data.accessToken;
  assert.equal(createJwtService(jwtConfig).verify(token), 1);
  const me = await request(app).get('/api/auth/me').auth(token, { type: 'bearer' }).expect(200);
  assert.deepEqual(me.body.data, response.body.data.user);
  await request(app).get('/api/productos').auth(token, { type: 'bearer' }).expect(200);
});

test('todos los métodos de negocio y me exigen autenticación por defecto', async () => {
  const { app, calls } = fixture();
  for (const resource of ['productos', 'vendedores', 'ventas']) {
    await request(app).get(`/api/${resource}`).expect(401);
    await request(app).get(`/api/${resource}/1`).expect(401);
    for (const method of ['post', 'put', 'patch']) {
      const path = `/api/${resource}${method === 'post' ? '' : '/1'}`;
      const response = await request(app)[method](path).send({}).expect(401);
      assert.equal(response.body.error.code, 'UNAUTHENTICATED');
      assert.equal(response.headers['www-authenticate'], 'Bearer');
    }
    await request(app).delete(`/api/${resource}/1`).expect(401);
  }
  await request(app).get('/api/auth/me').expect(401);
  assert.equal(calls.length, 0);
});

test('tokens vencidos, manipulados o con claims y algoritmo incorrectos se rechazan antes del SQL', async () => {
  const { app, calls } = fixture();
  const options = { subject: '1', issuer: jwtConfig.issuer, audience: jwtConfig.audience, expiresIn: 900 };
  const invalidTokens = [
    'no-es-jwt',
    jwt.sign({}, 'otro-secreto-largo-para-la-prueba', options),
    jwt.sign({}, jwtConfig.secret, { ...options, expiresIn: -1 }),
    jwt.sign({}, jwtConfig.secret, { ...options, issuer: 'otro' }),
    jwt.sign({}, jwtConfig.secret, { ...options, audience: 'otro' }),
    jwt.sign({}, jwtConfig.secret, { ...options, algorithm: 'HS384' }),
    jwt.sign({}, jwtConfig.secret, { ...options, subject: 'abc' }),
  ];
  for (const token of invalidTokens) await request(app).get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
  assert.equal(calls.length, 0);
});

test('credenciales incorrectas, usuarios inexistentes e inactivos devuelven el mismo error', async () => {
  for (const currentUser of [user, undefined, { ...user, activo: false }]) {
    const { app } = fixture(currentUser === undefined ? null : currentUser);
    const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'incorrecta' }).expect(401);
    assert.equal(response.body.error.message, 'Email o contraseña incorrectos.');
    assert.ok(!response.text.includes('password_hash'));
  }
  const { app } = fixture({ ...user, activo: false });
  await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(401);
});

test('desactivar o borrar el usuario impide usar un JWT todavía vigente', async () => {
  const token = createJwtService(jwtConfig).sign(1);
  for (const currentUser of [null, { ...user, activo: false }]) {
    const { app } = fixture(currentUser);
    await request(app).get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
  }
});

test('login valida entradas y limita peticiones con 429 y Retry-After', async () => {
  const { app, calls } = fixture();
  for (let attempt = 0; attempt < 10; attempt++) {
    await request(app).post('/api/auth/login').send({ email: 'incorrecto', password }).expect(400);
  }
  const response = await request(app).post('/api/auth/login').send({ email: user.email, password }).expect(429);
  assert.equal(response.body.error.code, 'TOO_MANY_REQUESTS');
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
  assert.ok(Number(response.headers['retry-after']) > 0);
  assert.equal(calls.length, 0);
});

test('hashes usan sal aleatoria y JWT exige secreto configurado', async () => {
  const anotherHash = await hashPassword(password);
  assert.notEqual(anotherHash, passwordHash);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('otra', passwordHash), false);
  assert.equal(await verifyPassword(password, 'hash-inválido'), false);
  assert.throws(() => readJwtConfig({}), /JWT_SECRET/);
  assert.throws(() => readJwtConfig({ JWT_SECRET: 'corta' }), /JWT_SECRET/);
});
