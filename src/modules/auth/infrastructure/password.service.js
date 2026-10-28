import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const dummyHash = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const format = /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/;
  const validFormat = typeof storedHash === 'string' && format.test(storedHash);
  const [, salt, expected] = (validFormat ? storedHash : dummyHash).split('$');
  const actual = await scrypt(password, salt, 64, options);
  const matches = timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  return validFormat && matches;
}
