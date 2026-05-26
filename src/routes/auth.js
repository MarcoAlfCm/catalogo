const express = require('express');
const { hashPassword, verifyPassword } = require('../services/password');
const {
  setAdminCookie,
  clearAdminCookie,
  getAdminSession,
  setCustomerCookie,
  clearCustomerCookie,
  getCustomerSession
} = require('../services/session');
const {
  findUserByEmail,
  createCustomerUser,
  updateLastLogin
} = require('../repositories/userRepository');

const router = express.Router();

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role
  };
}

function getSafeNext(value, fallback = '/cuenta') {
  const next = String(value || fallback).trim();
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

router.get('/admin/me', function(req, res) {
  try {
    const session = getAdminSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, message: 'Sin sesión administrativa.' });
    }

    res.json({ ok: true, user: session });
  } catch (error) {
    res.status(401).json({ ok: false, message: 'Sesión inválida.' });
  }
});

router.post('/admin/login', asyncHandler(async function(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
  }

  const user = await findUserByEmail(email);
  const validPassword = user && verifyPassword(password, user.passwordHash);
  const isValidAdmin = user && user.role === 'admin' && user.status === 'Activo' && validPassword;

  if (!isValidAdmin) {
    return res.status(401).json({ ok: false, message: 'Credenciales administrativas inválidas.' });
  }

  await updateLastLogin(user.id);
  setAdminCookie(res, user);

  res.json({
    ok: true,
    user: publicUser(user)
  });
}));

router.post('/admin/logout', function(req, res) {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get('/customer/me', function(req, res) {
  try {
    const session = getCustomerSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, message: 'Sin sesión de cliente.' });
    }

    res.json({ ok: true, user: session });
  } catch (error) {
    res.status(401).json({ ok: false, message: 'Sesión inválida.' });
  }
});

router.post('/customer/login', asyncHandler(async function(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
  }

  const user = await findUserByEmail(email);
  const validPassword = user && verifyPassword(password, user.passwordHash);
  const isValidCustomer = user && user.role === 'cliente' && user.status === 'Activo' && validPassword;

  if (!isValidCustomer) {
    return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
  }

  await updateLastLogin(user.id);
  setCustomerCookie(res, user);

  res.json({
    ok: true,
    next: getSafeNext(req.body.next),
    user: publicUser(user)
  });
}));

router.post('/customer/register', asyncHandler(async function(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'Nombre, correo y contraseña son obligatorios.' });
  }

  const user = await createCustomerUser({
    name,
    email,
    phone,
    passwordHash: hashPassword(password)
  });

  await updateLastLogin(user.id);
  setCustomerCookie(res, user);

  res.status(201).json({
    ok: true,
    next: getSafeNext(req.body.next),
    user: publicUser(user)
  });
}));

router.post('/customer/logout', function(req, res) {
  clearCustomerCookie(res);
  res.json({ ok: true });
});

router.use(function(error, req, res, next) {
  console.error('[catalogo-auth]', error);
  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    message: error.message || 'Error interno de autenticación.'
  });
});

module.exports = router;
