import { AuthenticationError } from '../../../shared/domain/errors.js';
import { publicUser, validateCredentials } from '../domain/credentials.js';

export function createAuthUseCases({ users, passwords, tokens }) {
  return {
    async login(input) {
      const { email, password } = validateCredentials(input);
      const user = await users.findByEmail(email);
      // También ejecuta el hash para usuarios inexistentes o desactivados.
      const valid = await passwords.verify(password, user?.password_hash);
      if (!user || !valid || !user.activo) throw new AuthenticationError('Email o contraseña incorrectos.');
      return {
        accessToken: tokens.sign(user.id, user.token_version ?? 0),
        tokenType: 'Bearer',
        expiresIn: tokens.expiresIn,
        user: publicUser(user),
      };
    },
    async authenticate(token) {
      const identity = tokens.verifyIdentity(token);
      const user = await users.findById(identity.id);
      if (!user?.activo || (user.token_version ?? 0) !== identity.version) throw new AuthenticationError();
      return publicUser(user);
    },
  };
}
