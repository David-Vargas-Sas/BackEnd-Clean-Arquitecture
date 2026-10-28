import { AuthenticationError } from '../../../shared/domain/errors.js';

export function createAuthenticate(useCases) {
  return async (req, res, next) => {
    const header = req.get('Authorization');
    const match = typeof header === 'string' && /^Bearer ([^\s]+)$/i.exec(header);
    if (!match || match[1].length > 4096) throw new AuthenticationError();
    req.user = await useCases.authenticate(match[1]);
    next();
  };
}
