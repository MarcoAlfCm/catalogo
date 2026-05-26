const defaultProducts = require('../data/defaultProducts');
const { getPool, getMode } = require('../services/db');
const { ensureCategory, seedMemoryCategories } = require('./categoryRepository');
const { createId, slugify, normalizeProduct, parseSpecs, defaultImage } = require('../services/helpers');

let memoryProducts = defaultProducts.map(normalizeProduct);
seedMemoryCategories(memoryProducts);

function withUniqueSlug(baseSlug, id) {
  const slug = baseSlug || `producto-${Date.now()}`;
  const exists = memoryProducts.some(product => product.slug === slug && product.id !== id);
  return exists ? `${slug}-${String(id).slice(0, 8)}` : slug;
}

function mapDbRow(row) {
  return normalizeProduct({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_name || row.category || 'Manualidades',
    price: row.price,
    measures: row.measures,
    material: row.material,
    time: row.production_time,
    stock: row.availability,
    status: row.status,
    personalizable: row.personalizable,
    specs: row.specs_json,
    detail: row.detail,
    image: row.main_image_url,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
}

async function listProducts(options = {}) {
  const includeHidden = Boolean(options.includeHidden);

  if (getMode() !== 'mysql') {
    return memoryProducts
      .filter(product => includeHidden ? product.status !== 'Archivado' : product.status === 'Publicado')
      .map(normalizeProduct);
  }

  const pool = getPool();
  const where = includeHidden
    ? "p.status <> 'Archivado'"
    : "p.status = 'Publicado'";

  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where}
      ORDER BY p.created_at DESC`
  );

  return rows.map(mapDbRow);
}

async function getProductBySlug(slugOrId, options = {}) {
  const includeHidden = Boolean(options.includeHidden);

  if (getMode() !== 'mysql') {
    return memoryProducts
      .filter(product => includeHidden ? product.status !== 'Archivado' : product.status === 'Publicado')
      .find(product => product.slug === slugOrId || product.id === slugOrId) || null;
  }

  const pool = getPool();
  const statusClause = includeHidden ? "AND p.status <> 'Archivado'" : "AND p.status = 'Publicado'";
  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE (p.slug = ? OR p.id = ?)
        ${statusClause}
      LIMIT 1`,
    [slugOrId, slugOrId]
  );

  return rows.length ? mapDbRow(rows[0]) : null;
}

async function createProduct(input = {}) {
  const id = input.id || createId();
  const normalized = normalizeProduct({
    ...input,
    id,
    slug: input.slug || slugify(input.name),
    image: input.image || input.main_image_url || defaultImage,
    specs: parseSpecs(input.specs || input.specs_json)
  });

  normalized.slug = slugify(normalized.slug || normalized.name);

  if (getMode() !== 'mysql') {
    normalized.slug = withUniqueSlug(normalized.slug, id);
    memoryProducts.unshift(normalized);
    seedMemoryCategories(memoryProducts);
    return normalized;
  }

  const pool = getPool();
  const category = await ensureCategory(normalized.category);

  try {
    await pool.execute(
      `INSERT INTO products
        (id, category_id, slug, name, price, measures, material, production_time, availability, status, personalizable, specs_json, detail, main_image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.id,
        category.id,
        normalized.slug,
        normalized.name,
        normalized.price,
        normalized.measures,
        normalized.material,
        normalized.time,
        normalized.stock,
        normalized.status,
        normalized.personalizable,
        JSON.stringify(normalized.specs),
        normalized.detail,
        normalized.image
      ]
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      normalized.slug = `${normalized.slug}-${String(normalized.id).slice(0, 8)}`;
      await pool.execute(
        `INSERT INTO products
          (id, category_id, slug, name, price, measures, material, production_time, availability, status, personalizable, specs_json, detail, main_image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          category.id,
          normalized.slug,
          normalized.name,
          normalized.price,
          normalized.measures,
          normalized.material,
          normalized.time,
          normalized.stock,
          normalized.status,
          normalized.personalizable,
          JSON.stringify(normalized.specs),
          normalized.detail,
          normalized.image
        ]
      );
    } else {
      throw error;
    }
  }

  return normalized;
}

async function updateProduct(id, input = {}) {
  const current = await getProductBySlug(id, { includeHidden: true });
  if (!current) return null;

  const normalized = normalizeProduct({
    ...current,
    ...input,
    id,
    slug: input.slug || current.slug || slugify(input.name || current.name),
    image: input.image || input.main_image_url || current.image,
    specs: parseSpecs(input.specs || input.specs_json || current.specs)
  });

  normalized.slug = slugify(normalized.slug || normalized.name);

  if (getMode() !== 'mysql') {
    normalized.slug = withUniqueSlug(normalized.slug, id);
    memoryProducts = memoryProducts.map(product => product.id === id ? normalized : product);
    seedMemoryCategories(memoryProducts);
    return normalized;
  }

  const pool = getPool();
  const category = await ensureCategory(normalized.category);
  await pool.execute(
    `UPDATE products
        SET category_id = ?,
            slug = ?,
            name = ?,
            price = ?,
            measures = ?,
            material = ?,
            production_time = ?,
            availability = ?,
            status = ?,
            personalizable = ?,
            specs_json = ?,
            detail = ?,
            main_image_url = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      category.id,
      normalized.slug,
      normalized.name,
      normalized.price,
      normalized.measures,
      normalized.material,
      normalized.time,
      normalized.stock,
      normalized.status,
      normalized.personalizable,
      JSON.stringify(normalized.specs),
      normalized.detail,
      normalized.image,
      id
    ]
  );

  return normalized;
}

async function archiveProduct(id) {
  if (getMode() !== 'mysql') {
    memoryProducts = memoryProducts.map(product => product.id === id
      ? { ...product, status: 'Archivado' }
      : product
    );
    return true;
  }

  const pool = getPool();
  const [result] = await pool.execute(
    "UPDATE products SET status = 'Archivado', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

async function resetDemoProducts() {
  if (getMode() !== 'mysql') {
    memoryProducts = defaultProducts.map(normalizeProduct);
    seedMemoryCategories(memoryProducts);
    return memoryProducts;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM order_items');
    await connection.execute('DELETE FROM orders');
    await connection.execute('DELETE FROM product_images');
    await connection.execute('DELETE FROM products');
    await connection.execute('DELETE FROM categories');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const created = [];
  for (const product of defaultProducts) {
    created.push(await createProduct(product));
  }
  return created;
}

module.exports = {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  archiveProduct,
  resetDemoProducts
};
