const crypto = require('crypto');

const defaultImage = 'https://images.unsplash.com/photo-1516685304081-de7947d419d0?w=900&auto=format&fit=crop&q=80';

function createId() {
  return crypto.randomUUID();
}

function slugify(value) {
  return String(value || 'producto-artesanal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `producto-${Date.now()}`;
}

function parseSpecs(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
  } catch (error) {
    // Se acepta texto separado por comas.
  }
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeProduct(product = {}) {
  const name = product.name || product.nombre || 'Producto artesanal';
  const category = product.category || product.categoria || product.category_name || 'Manualidades';
  const specs = parseSpecs(product.specs || product.specs_json || product.especificaciones);

  return {
    id: product.id || createId(),
    slug: product.slug || slugify(name),
    name,
    category,
    price: Number(product.price ?? product.precio ?? 0),
    measures: product.measures || product.medidas || 'Medidas por confirmar',
    material: product.material || 'Material por confirmar',
    time: product.time || product.production_time || product.tiempo || 'Por confirmar',
    stock: product.stock || product.availability || product.disponibilidad || 'Por confirmar',
    status: product.status || product.estado || 'Publicado',
    personalizable: product.personalizable || product.customizable || 'Sí',
    specs: specs.length ? specs : ['Personalizable'],
    detail: product.detail || product.detalle || product.description || 'Detalle pendiente.',
    image: product.image || product.main_image_url || product.imagen || defaultImage,
    createdAt: product.created_at || product.createdAt || null,
    updatedAt: product.updated_at || product.updatedAt || null
  };
}

function normalizeCategoryName(value) {
  return String(value || 'Manualidades').trim() || 'Manualidades';
}

function normalizeOrderNumber(id) {
  return `PED-${String(id).slice(0, 8).toUpperCase()}`;
}

module.exports = {
  createId,
  slugify,
  parseSpecs,
  normalizeProduct,
  normalizeCategoryName,
  normalizeOrderNumber,
  defaultImage
};
