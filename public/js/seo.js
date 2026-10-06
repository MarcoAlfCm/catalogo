(function(window, document) {
  'use strict';

  const SITE = {
    origin: 'https://cajadecreaciones.com',
    name: 'Caja de Creaciones',
    alternateName: 'cajadecreaciones',
    description: 'Catálogo artesanal de Caja de Creaciones: llaveros personalizados, piezas en impresión 3D, resina, regalos creativos y detalles hechos a mano en México.',
    image: 'https://cajadecreaciones.com/assets/seo/caja-de-creaciones-og.jpg',
    logo: 'https://cajadecreaciones.com/assets/seo/caja-de-creaciones-logo.png',
    locale: 'es_MX'
  };

  function cleanText(value, maxLength) {
    const text = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!maxLength || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  function absoluteUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '/').trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${SITE.origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  function slugify(value) {
    return String(value || 'catalogo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'catalogo';
  }

  function setMeta(selector, attrName, attrValue, content) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attrName, attrValue);
      document.head.appendChild(element);
    }
    element.setAttribute('content', cleanText(content));
  }

  function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', absoluteUrl(url));
  }

  function setTitle(title) {
    document.title = cleanText(title, 70);
  }

  function replaceJsonLd(id, payload) {
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(payload);
  }

  function applyPageMeta({ title, description, canonical, image, type }) {
    const safeTitle = cleanText(title, 70);
    const safeDescription = cleanText(description || SITE.description, 160);
    const safeCanonical = absoluteUrl(canonical || window.location.pathname || '/');
    const safeImage = absoluteUrl(image || SITE.image);

    setTitle(safeTitle);
    setMeta('meta[name="description"]', 'name', 'description', safeDescription);
    setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', safeTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', safeDescription);
    setMeta('meta[property="og:url"]', 'property', 'og:url', safeCanonical);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type || 'website');
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE.name);
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', SITE.locale);
    setMeta('meta[property="og:image"]', 'property', 'og:image', safeImage);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', safeTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', safeDescription);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', safeImage);
    setCanonical(safeCanonical);
  }

  function applyCatalog() {
    applyPageMeta({
      title: 'Caja de Creaciones | Catálogo de manualidades, llaveros 3D y resina',
      description: SITE.description,
      canonical: '/catalogo',
      image: SITE.image,
      type: 'website'
    });

    replaceJsonLd('schema-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: SITE.origin,
      name: SITE.name,
      alternateName: SITE.alternateName,
      inLanguage: 'es-MX'
    });

    replaceJsonLd('schema-local-business', {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: SITE.name,
      url: SITE.origin,
      description: SITE.description,
      image: SITE.image,
      logo: SITE.logo,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Querétaro',
        addressRegion: 'Querétaro',
        addressCountry: 'MX'
      },
      areaServed: {
        '@type': 'Country',
        name: 'México'
      }
    });
  }

  function applyCategory(categoryName) {
    const category = cleanText(categoryName || 'Manualidades', 80);
    const slug = slugify(category);
    applyPageMeta({
      title: `${category} | Caja de Creaciones`,
      description: `Explora productos de ${category} en Caja de Creaciones: piezas artesanales, regalos personalizados, detalles hechos a mano, resina e impresión 3D bajo pedido.`,
      canonical: `/categoria/${slug}`,
      image: SITE.image,
      type: 'website'
    });
  }

  function availabilityUrl(stock) {
    const normalized = String(stock || '').toLowerCase();
    if (normalized.includes('agotado')) return 'https://schema.org/OutOfStock';
    if (normalized.includes('disponible')) return 'https://schema.org/InStock';
    return 'https://schema.org/PreOrder';
  }

  function applyProduct(product) {
    if (!product) return;

    const slug = product.slug || product.id || slugify(product.name);
    const image = absoluteUrl(product.image || SITE.image);
    const title = `${product.name} | Caja de Creaciones`;
    const description = product.detail || `${product.name} de Caja de Creaciones. Producto artesanal personalizable en México.`;

    applyPageMeta({
      title,
      description,
      canonical: `/producto/${slug}`,
      image,
      type: 'product'
    });

    replaceJsonLd('schema-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: cleanText(description, 500),
      image: [image],
      brand: {
        '@type': 'Brand',
        name: SITE.name
      },
      category: product.category || 'Manualidades',
      sku: product.id || slug,
      offers: {
        '@type': 'Offer',
        url: absoluteUrl(`/producto/${slug}`),
        priceCurrency: 'MXN',
        price: String(Number(product.price || 0).toFixed(2)),
        availability: availabilityUrl(product.stock),
        itemCondition: 'https://schema.org/NewCondition'
      }
    });
  }

  window.CatalogSEO = {
    SITE,
    slugify,
    absoluteUrl,
    applyCatalog,
    applyCategory,
    applyProduct
  };
})(window, document);
