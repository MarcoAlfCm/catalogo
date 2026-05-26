const crypto = require('crypto');

const ADMIN_COOKIE_NAME = 'catalogo_admin_session';
const CUSTOMER_COOKIE_NAME = 'catalogo_customer_session';

function getSecret(secretName, fallbackName) {
  const secret = process.env[secretName] || (fallbackName ? process.env[fallbackName] : '');
  if (!secret || secret.length < 24) {
    throw new Error(`Falta configurar ${secretName} con al menos 24 caracteres.`);
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getSessionHours(envName, fallbackHours) {
  return Math.max(1, Number(process.env[envName] || fallbackHours));
}

function createToken(user, options = {}) {
  const now = Date.now();
  const expiresAt = now + options.hours * 60 * 60 * 1000;
  const payloadObject = {
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    iat: now,
    exp: expiresAt
  };

  const payload = base64url(JSON.stringify(payloadObject));
  return `${payload}.${sign(payload, options.secret)}`;
}

function verifyToken(token, options = {}) {
  if (!token || !String(token).includes('.')) return null;

  const [payload, signature] = String(token).split('.');
  const expectedSignature = sign(payload, options.secret);

  const signatureBuffer = Buffer.from(signature || '', 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  const session = JSON.parse(fromBase64url(payload));
  if (!session || session.role !== options.role) return null;
  if (!session.exp || Date.now() > Number(session.exp)) return null;

  return session;
}

function getCookieOptions() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function getAdminOptions() {
  return {
    role: 'admin',
    secret: getSecret('ADMIN_SESSION_SECRET'),
    hours: getSessionHours('ADMIN_SESSION_HOURS', 8)
  };
}

function getCustomerOptions() {
  return {
    role: 'cliente',
    secret: getSecret('CUSTOMER_SESSION_SECRET', 'ADMIN_SESSION_SECRET'),
    hours: getSessionHours('CUSTOMER_SESSION_HOURS', 24 * 7)
  };
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[ADMIN_COOKIE_NAME], getAdminOptions());
}

function setAdminCookie(res, user) {
  const options = getAdminOptions();
  const token = createToken(user, options);
  const maxAge = options.hours * 60 * 60;

  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${getCookieOptions()}`
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; Max-Age=0; ${getCookieOptions()}`
  );
}

function getCustomerSession(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[CUSTOMER_COOKIE_NAME], getCustomerOptions());
}

function setCustomerCookie(res, user) {
  const options = getCustomerOptions();
  const token = createToken(user, options);
  const maxAge = options.hours * 60 * 60;

  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${getCookieOptions()}`
  );
}

function clearCustomerCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_COOKIE_NAME}=; Max-Age=0; ${getCookieOptions()}`
  );
}

module.exports = {
  COOKIE_NAME: ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  CUSTOMER_COOKIE_NAME,
  getAdminSession,
  setAdminCookie,
  clearAdminCookie,
  getCustomerSession,
  setCustomerCookie,
  clearCustomerCookie
};
