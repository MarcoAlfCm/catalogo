const mysql = require('mysql2/promise');

let pool = null;
let mode = 'memory';
let lastError = null;

function wantsMysql() {
  return String(process.env.DATA_SOURCE || '').toLowerCase() === 'mysql' || Boolean(process.env.DB_HOST);
}

function getMode() {
  return mode;
}

function getLastError() {
  return lastError;
}

async function initDb() {
  if (!wantsMysql()) {
    mode = 'memory';
    return { mode };
  }

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    mode = 'mysql';
    lastError = null;
    return { mode };
  } catch (error) {
    lastError = error.message;
    mode = process.env.DB_STRICT === 'true' ? 'mysql-error' : 'memory';

    if (process.env.DB_STRICT === 'true') {
      throw error;
    }

    console.warn('[catalogo] MySQL no disponible. Se usará memoria temporal:', error.message);
    return { mode, warning: error.message };
  }
}

function getPool() {
  if (!pool || mode !== 'mysql') {
    throw new Error('La conexión MySQL no está activa. Revisa DATA_SOURCE, DB_HOST, DB_USER, DB_PASSWORD y DB_NAME.');
  }
  return pool;
}

module.exports = {
  initDb,
  getPool,
  getMode,
  getLastError
};
