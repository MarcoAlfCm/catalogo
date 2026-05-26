const { getAdminSession, getCustomerSession } = require('../services/session');

function requireAdminPage(req, res, next) {
  try {
    const session = getAdminSession(req);
    if (session) {
      req.adminSession = session;
      return next();
    }
  } catch (error) {
    console.warn('[admin-auth-page]', error.message);
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/admin/login?next=${nextUrl}`);
}

function requireAdminApi(req, res, next) {
  try {
    const session = getAdminSession(req);
    if (session) {
      req.adminSession = session;
      return next();
    }
  } catch (error) {
    console.warn('[admin-auth-api]', error.message);
  }

  return res.status(401).json({
    ok: false,
    message: 'Sesión administrativa requerida.',
    loginUrl: '/admin/login'
  });
}

function requireCustomerPage(req, res, next) {
  try {
    const session = getCustomerSession(req);
    if (session) {
      req.customerSession = session;
      return next();
    }
  } catch (error) {
    console.warn('[customer-auth-page]', error.message);
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/pedido');
  return res.redirect(`/login?next=${nextUrl}`);
}

function requireCustomerApi(req, res, next) {
  try {
    const session = getCustomerSession(req);
    if (session) {
      req.customerSession = session;
      return next();
    }
  } catch (error) {
    console.warn('[customer-auth-api]', error.message);
  }

  return res.status(401).json({
    ok: false,
    message: 'Debes iniciar sesión para crear el pedido.',
    loginUrl: '/login'
  });
}

module.exports = {
  requireAdminPage,
  requireAdminApi,
  requireCustomerPage,
  requireCustomerApi
};
