import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../../../shared/domain/errors.js';

export function readJwtConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || secret.includes('CAMBIAR')) {
    throw new Error('Configura JWT_SECRET con al menos 32 bytes aleatorios en .env.');
  }
  return { secret, issuer: 'backend-ventas', audience: 'frontend-ventas', expiresIn: 900 };
}

export function createJwtService(config = readJwtConfig()) {
  const { secret, issuer, audience, expiresIn } = config;
  function verifyIdentity(token) {
    let payload;
    try { payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience, maxAge: expiresIn }); }
    catch { throw new AuthenticationError(); }
    if (typeof payload !== 'object' || !/^[1-9]\d*$/.test(payload.sub)
        || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)
        || Number(payload.sub) > 2147483647 || !Number.isInteger(payload.ver) || payload.ver < 0) throw new AuthenticationError();
    return { id: Number(payload.sub), version: payload.ver };
  }
  return {
    expiresIn,
    sign(id, version = 0) {
      return jwt.sign({ ver: version }, secret, { algorithm: 'HS256', subject: String(id), issuer, audience, expiresIn });
    },
    verifyIdentity,
    verify(token) {
      return verifyIdentity(token).id;
    },
  };
}
