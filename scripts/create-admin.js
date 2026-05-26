const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { hashPassword } = require('../src/services/password');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '');
  const name = String(process.argv[4] || 'Administrador').trim();

  if (!email || !email.includes('@')) {
    throw new Error('Uso: node scripts/create-admin.js correo@dominio.com "ContraseñaSegura" "Nombre Admin"');
  }

  if (!password || password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  });

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  await connection.execute(
    `INSERT INTO users (id, role, name, email, password_hash, status)
     VALUES (?, 'admin', ?, ?, ?, 'Activo')
     ON DUPLICATE KEY UPDATE
       role = 'admin',
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       status = 'Activo'`,
    [id, name, email, passwordHash]
  );

  await connection.end();
  console.log(`Admin listo: ${email}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
