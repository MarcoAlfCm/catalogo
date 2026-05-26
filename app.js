const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const apiRouter = require('./src/routes/api');
const authRouter = require('./src/routes/auth');
const { requireAdminPage, requireCustomerPage } = require('./src/middleware/auth');
const { initDb } = require('./src/services/db');

const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 3015;
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(path.join(PUBLIC_DIR, 'uploads/products'), { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'uploads/custom-orders'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: process.env.JSON_LIMIT || '3mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '3mb' }));

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.use('/css', express.static(path.join(PUBLIC_DIR, 'css')));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js')));
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));

app.get('/health', function(req, res) {
  res.json({
    ok: true,
    app: 'catalogo',
    status: 'running',
    env: process.env.NODE_ENV || 'development'
  });
});

app.get(['/', '/catalogo'], function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/producto/:slug', function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'producto.html'));
});

app.get('/login', function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/admin/login', function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin-login.html'));
});

app.get('/pedido', requireCustomerPage, function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'pedido.html'));
});

app.get('/cuenta', requireCustomerPage, function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'cuenta.html'));
});

app.get('/cuenta/pedido/:id', requireCustomerPage, function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'cuenta-pedido.html'));
});

app.get('/personalizado', requireCustomerPage, function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'personalizado.html'));
});

app.get(['/admin', '/admin/'], requireAdminPage, function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.use(function(req, res) {
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

initDb()
  .then(result => {
    app.listen(PORT, '127.0.0.1', function() {
      console.log(`Catalogo escuchando en http://127.0.0.1:${PORT} · storage=${result.mode}`);
    });
  })
  .catch(error => {
    console.error('No se pudo iniciar el catálogo:', error);
    process.exit(1);
  });
