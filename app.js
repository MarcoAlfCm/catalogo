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
const { listProducts, getProductBySlug } = require('./src/repositories/productRepository');
const { listCategories } = require('./src/repositories/categoryRepository');
const { SITE_ORIGIN, SITE_NAME, SITE_DESCRIPTION, siteUrl, sitemapUrl, absoluteImage, productJsonLd } = require('./src/config/seo');

const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 3015;
const PUBLIC_DIR = path.join(__dirname, 'public');

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanDescription(value) {
  const text = String(value || SITE_DESCRIPTION).replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 157).trim()}...` : text;
}

function safeJsonLd(payload) {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

function replaceMetaTag(html, selector, content) {
  const escaped = escapeHtmlAttr(content);
  const pattern = selector.startsWith('property=')
    ? new RegExp(`<meta\\s+property="${selector.slice(9)}"\\s+content="[^"]*"\\s*>`, 'i')
    : new RegExp(`<meta\\s+name="${selector.slice(5)}"\\s+content="[^"]*"\\s*>`, 'i');

  if (!pattern.test(html)) return html;

  const attr = selector.startsWith('property=') ? 'property' : 'name';
  const name = selector.startsWith('property=') ? selector.slice(9) : selector.slice(5);
  return html.replace(pattern, `<meta ${attr}="${name}" content="${escaped}">`);
}

function renderSeoHtml(fileName, meta, jsonLdList = []) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  let html = fs.readFileSync(filePath, 'utf8');
  const title = escapeHtmlAttr(meta.title || SITE_NAME);
  const description = cleanDescription(meta.description);
  const canonical = meta.canonical || siteUrl('/catalogo');
  const image = meta.image || siteUrl('/assets/seo/caja-de-creaciones-og.jpg');
  const type = meta.type || 'website';

  html = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*>/i, `<link rel="canonical" href="${escapeHtmlAttr(canonical)}">`);

  html = replaceMetaTag(html, 'name=description', description);
  html = replaceMetaTag(html, 'name=robots', 'index, follow');
  html = replaceMetaTag(html, 'property=og:title', meta.title || SITE_NAME);
  html = replaceMetaTag(html, 'property=og:description', description);
  html = replaceMetaTag(html, 'property=og:type', type);
  html = replaceMetaTag(html, 'property=og:url', canonical);
  html = replaceMetaTag(html, 'property=og:image', image);
  html = replaceMetaTag(html, 'name=twitter:title', meta.title || SITE_NAME);
  html = replaceMetaTag(html, 'name=twitter:description', description);
  html = replaceMetaTag(html, 'name=twitter:image', image);

  const dynamicJsonLd = jsonLdList.map(item => `  <script type="application/ld+json" id="${escapeHtmlAttr(item.id)}">${safeJsonLd(item.payload)}</script>`).join('\n');
  if (dynamicJsonLd) {
    html = html.replace('</head>', `${dynamicJsonLd}\n</head>`);
  }

  return html;
}

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


app.get('/robots.txt', function(req, res) {
  res.type('text/plain');
  res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/auth',
    'Disallow: /api/admin',
    'Allow: /api/catalog',
    'Disallow: /pedido',
    'Disallow: /cuenta',
    'Disallow: /personalizado',
    '',
    `Sitemap: ${siteUrl('/sitemap.xml')}`,
    ''
  ].join('\n'));
});

app.get('/sitemap.xml', async function(req, res) {
  try {
    const [products, categories] = await Promise.all([
      listProducts({ includeHidden: false }),
      listCategories()
    ]);

    const urls = [
      sitemapUrl(siteUrl('/'), new Date(), '1.0'),
      sitemapUrl(siteUrl('/catalogo'), new Date(), '0.9'),
      ...categories
        .filter(category => Number(category.productCount || 0) > 0)
        .map(category => sitemapUrl(siteUrl(`/categoria/${category.slug}`), new Date(), '0.8')),
      ...products.map(product => sitemapUrl(
        siteUrl(`/producto/${product.slug}`),
        product.updatedAt || product.createdAt || new Date(),
        '0.7'
      ))
    ];

    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  } catch (error) {
    console.error('[catalogo-sitemap]', error);
    res.status(500).type('text/plain').send('No se pudo generar el sitemap.');
  }
});

app.get('/health', function(req, res) {
  res.json({
    ok: true,
    app: 'catalogo',
    site: SITE_ORIGIN,
    status: 'running',
    env: process.env.NODE_ENV || 'development'
  });
});

app.get(['/', '/catalogo'], function(req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/producto/:slug', async function(req, res) {
  try {
    const product = await getProductBySlug(req.params.slug, { includeHidden: false });
    if (!product) {
      return res.sendFile(path.join(PUBLIC_DIR, 'producto.html'));
    }

    const canonical = siteUrl(`/producto/${product.slug}`);
    const image = absoluteImage(product.image);

    res.type('html').send(renderSeoHtml('producto.html', {
      title: `${product.name} | ${SITE_NAME}`,
      description: product.detail || `${product.name} de ${SITE_NAME}. Producto artesanal personalizable en México.`,
      canonical,
      image,
      type: 'product'
    }, [
      { id: 'schema-product', payload: productJsonLd(product) }
    ]));
  } catch (error) {
    console.error('[catalogo-producto-seo]', error);
    res.sendFile(path.join(PUBLIC_DIR, 'producto.html'));
  }
});

app.get('/categoria/:slug', async function(req, res) {
  try {
    const categories = await listCategories();
    const category = categories.find(item => item.slug === req.params.slug);
    if (!category) {
      return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }

    res.type('html').send(renderSeoHtml('index.html', {
      title: `${category.name} | ${SITE_NAME}`,
      description: `Explora productos de ${category.name} en ${SITE_NAME}: piezas artesanales, regalos personalizados, detalles hechos a mano, resina e impresión 3D bajo pedido.`,
      canonical: siteUrl(`/categoria/${category.slug}`),
      image: siteUrl('/assets/seo/caja-de-creaciones-og.jpg'),
      type: 'website'
    }));
  } catch (error) {
    console.error('[catalogo-categoria-seo]', error);
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
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
