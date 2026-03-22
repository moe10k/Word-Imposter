import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;

function deriveKey(password: string, salt: string, keyLength: number) {
  return scrypt(password, salt, keyLength) as Promise<Buffer>;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derivedKey = await deriveKey(password, salt, PASSWORD_KEY_LENGTH);

  return `${PASSWORD_HASH_ALGORITHM}:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(':');
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !hash) {
    return false;
  }

  const expectedHash = Buffer.from(hash, 'hex');
  const derivedKey = await deriveKey(password, salt, expectedHash.length);
  if (derivedKey.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedHash);
}
