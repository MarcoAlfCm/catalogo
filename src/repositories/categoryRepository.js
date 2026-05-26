const { getPool, getMode } = require('../services/db');
const { createId, slugify, normalizeCategoryName } = require('../services/helpers');

let memoryCategories = [];

function seedMemoryCategories(products) {
  const names = Array.from(new Set(products.map(product => product.category).filter(Boolean)));
  memoryCategories = names.map(name => ({
    id: createId(),
    name,
    slug: slugify(name),
    status: 'Activo',
    productCount: products.filter(product => product.category === name && product.status === 'Publicado').length
  }));
}

async function ensureCategory(name) {
  const categoryName = normalizeCategoryName(name);
  const slug = slugify(categoryName);

  if (getMode() !== 'mysql') {
    let category = memoryCategories.find(item => item.slug === slug || item.name === categoryName);
    if (!category) {
      category = { id: createId(), name: categoryName, slug, status: 'Activo', productCount: 0 };
      memoryCategories.push(category);
    }
    return category;
  }

  const pool = getPool();
  const [existing] = await pool.execute(
    'SELECT id, name, slug, status FROM categories WHERE slug = ? LIMIT 1',
    [slug]
  );

  if (existing.length) return existing[0];

  const id = createId();
  await pool.execute(
    'INSERT INTO categories (id, name, slug, status) VALUES (?, ?, ?, ?)',
    [id, categoryName, slug, 'Activo']
  );

  return { id, name: categoryName, slug, status: 'Activo' };
}

async function listCategories() {
  if (getMode() !== 'mysql') {
    return memoryCategories
      .filter(category => category.status !== 'Oculto')
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
        c.id,
        c.name,
        c.slug,
        c.status,
        COUNT(p.id) AS productCount
       FROM categories c
       LEFT JOIN products p
         ON p.category_id = c.id
        AND p.status = 'Publicado'
      WHERE c.status <> 'Oculto'
      GROUP BY c.id, c.name, c.slug, c.status
      ORDER BY c.name ASC`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    productCount: Number(row.productCount || 0)
  }));
}

module.exports = {
  seedMemoryCategories,
  ensureCategory,
  listCategories
};
