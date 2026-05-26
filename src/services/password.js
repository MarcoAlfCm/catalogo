const crypto = require('crypto');

const KEY_LENGTH = 64;

function hashPassword(password) {
  if (!password || String(password).length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const parts = String(storedHash).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = parts[1];
  const expected = parts[2];
  const calculated = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const calculatedBuffer = Buffer.from(calculated, 'hex');

  if (expectedBuffer.length !== calculatedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};
