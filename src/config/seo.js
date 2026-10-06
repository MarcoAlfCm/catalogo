const { slugify, defaultImage } = require('../services/helpers');

const SITE_ORIGIN = String(process.env.PUBLIC_SITE_URL || 'https://cajadecreaciones.com').replace(/\/$/, '');
const SITE_NAME = process.env.SITE_NAME || 'Caja de Creaciones';
const SITE_ALTERNATE_NAME = process.env.SITE_ALTERNATE_NAME || 'cajadecreaciones';
const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION || 'Catálogo artesanal de Caja de Creaciones: llaveros personalizados, piezas en impresión 3D, resina, regalos creativos y detalles hechos a mano en México.';
const SITE_LOCALE = 'es_MX';
const DEFAULT_IMAGE = process.env.SITE_DEFAULT_IMAGE || `${SITE_ORIGIN}/assets/seo/caja-de-creaciones-og.jpg`;

const BUSINESS = {
  name: SITE_NAME,
  url: SITE_ORIGIN,
  description: SITE_DESCRIPTION,
  logo: process.env.SITE_LOGO_URL || `${SITE_ORIGIN}/assets/seo/caja-de-creaciones-logo.png`,
  image: DEFAULT_IMAGE,
  telephone: process.env.SITE_PHONE || '',
  addressLocality: process.env.SITE_LOCALITY || 'Querétaro',
  addressRegion: process.env.SITE_REGION || 'Querétaro',
  addressCountry: process.env.SITE_COUNTRY || 'MX',
  areaServed: process.env.SITE_AREA_SERVED || 'México',
  instagram: process.env.SITE_INSTAGRAM || '',
  facebook: process.env.SITE_FACEBOOK || ''
};

function siteUrl(pathname = '/') {
  const cleanPath = pathname && pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
  return `${SITE_ORIGIN}${cleanPath}`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteImage(url) {
  const raw = String(url || '').trim();
  if (!raw) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  return siteUrl(raw.startsWith('/') ? raw : `/${raw}`);
}


function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_ORIGIN,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    inLanguage: 'es-MX'
  };
}

function localBusinessJsonLd() {
  const sameAs = [BUSINESS.instagram, BUSINESS.facebook].filter(Boolean);

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: BUSINESS.name,
    url: BUSINESS.url,
    description: BUSINESS.description,
    image: BUSINESS.image,
    logo: BUSINESS.logo,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BUSINESS.addressLocality,
      addressRegion: BUSINESS.addressRegion,
      addressCountry: BUSINESS.addressCountry
    },
    areaServed: {
      '@type': 'Country',
      name: BUSINESS.areaServed
    }
  };

  if (BUSINESS.telephone) payload.telephone = BUSINESS.telephone;
  if (sameAs.length) payload.sameAs = sameAs;

  return payload;
}

function productAvailability(product) {
  const availability = String(product.stock || product.availability || '').toLowerCase();
  if (availability.includes('agotado')) return 'https://schema.org/OutOfStock';
  if (availability.includes('disponible')) return 'https://schema.org/InStock';
  return 'https://schema.org/PreOrder';
}

function productJsonLd(product) {
  const slug = product.slug || slugify(product.name || 'producto');
  const productUrl = siteUrl(`/producto/${slug}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.detail || `${product.name} de ${SITE_NAME}.`,
    image: [absoluteImage(product.image || product.main_image_url || defaultImage)],
    brand: {
      '@type': 'Brand',
      name: SITE_NAME
    },
    category: product.category || product.category_name || 'Manualidades',
    sku: product.id || slug,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'MXN',
      price: String(Number(product.price || 0).toFixed(2)),
      availability: productAvailability(product),
      itemCondition: 'https://schema.org/NewCondition'
    }
  };
}

function sitemapUrl(location, lastmod, priority = '0.7') {
  return [
    '  <url>',
    `    <loc>${xmlEscape(location)}</loc>`,
    `    <lastmod>${xmlEscape(toIsoDate(lastmod))}</lastmod>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    '  </url>'
  ].join('\n');
}

module.exports = {
  SITE_ORIGIN,
  SITE_NAME,
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  DEFAULT_IMAGE,
  BUSINESS,
  siteUrl,
  toIsoDate,
  xmlEscape,
  absoluteImage,
  websiteJsonLd,
  localBusinessJsonLd,
  productJsonLd,
  sitemapUrl
};
