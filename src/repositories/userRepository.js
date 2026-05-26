const { getPool, getMode } = require('../services/db');
const { createId } = require('../services/helpers');

function ensureMysqlForAuth() {
  if (getMode() !== 'mysql') {
    const error = new Error('El login requiere MySQL activo. Revisa /api/status.');
    error.status = 503;
    throw error;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findUserByEmail(email) {
  ensureMysqlForAuth();

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id,
            role,
            name,
            email,
            phone,
            password_hash AS passwordHash,
            status,
            last_login_at AS lastLoginAt,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [normalizeEmail(email)]
  );

  return rows[0] || null;
}

async function createCustomerUser(input = {}) {
  ensureMysqlForAuth();

  const email = normalizeEmail(input.email);
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim() || null;
  const passwordHash = input.passwordHash;

  if (!name) {
    const error = new Error('El nombre es obligatorio.');
    error.status = 400;
    throw error;
  }

  if (!email || !email.includes('@')) {
    const error = new Error('Correo válido obligatorio.');
    error.status = 400;
    throw error;
  }

  if (!passwordHash) {
    const error = new Error('La contraseña es obligatoria.');
    error.status = 400;
    throw error;
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    const error = new Error('Ese correo ya está registrado. Inicia sesión para continuar.');
    error.status = 409;
    throw error;
  }

  const id = createId();
  const pool = getPool();
  await pool.execute(
    `INSERT INTO users (id, role, name, email, phone, password_hash, status)
     VALUES (?, 'cliente', ?, ?, ?, ?, 'Activo')`,
    [id, name, email, phone, passwordHash]
  );

  return findUserByEmail(email);
}

async function updateCustomerProfile(userId, input = {}) {
  ensureMysqlForAuth();

  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim() || null;

  if (!name && phone === null) return null;

  const pool = getPool();
  await pool.execute(
    `UPDATE users
        SET name = COALESCE(NULLIF(?, ''), name),
            phone = COALESCE(?, phone)
      WHERE id = ?
        AND role = 'cliente'`,
    [name, phone, userId]
  );

  const [rows] = await pool.execute(
    `SELECT id,
            role,
            name,
            email,
            phone,
            password_hash AS passwordHash,
            status,
            last_login_at AS lastLoginAt,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM users
      WHERE id = ?
        AND role = 'cliente'
      LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function updateLastLogin(userId) {
  if (getMode() !== 'mysql') return;

  const pool = getPool();
  await pool.execute(
    `UPDATE users
        SET last_login_at = NOW()
      WHERE id = ?`,
    [userId]
  );
}

module.exports = {
  findUserByEmail,
  createCustomerUser,
  updateCustomerProfile,
  updateLastLogin
};
