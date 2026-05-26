const { getPool, getMode } = require('../services/db');
const { getProductBySlug } = require('./productRepository');
const { createId, normalizeOrderNumber } = require('../services/helpers');

const ORDER_STATUSES = [
  'Pendiente de revisión',
  'Confirmado',
  'En elaboración',
  'Listo para entrega',
  'Entregado',
  'Cancelado'
];

let memoryOrders = [
  {
    id: 'demo-order-001',
    orderNumber: 'PED-0001',
    customerUserId: null,
    customerName: 'Cliente preview',
    customerEmail: 'preview@cliente.local',
    customerPhone: 'Por confirmar',
    deliveryType: 'Por confirmar',
    dateNeeded: null,
    notes: 'Pedido de ejemplo para revisar el flujo administrativo.',
    adminNote: 'Mensaje visible para el cliente cuando el admin lo guarde.',
    status: 'Pendiente de revisión',
    subtotalEstimated: 470,
    totalEstimated: 470,
    aiSummary: null,
    aiPayload: null,
    items: []
  }
];

function parseJsonSafe(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function assertValidStatus(status) {
  const normalizedStatus = String(status || '').trim();
  if (!ORDER_STATUSES.includes(normalizedStatus)) {
    const error = new Error('Estado de pedido inválido.');
    error.status = 400;
    throw error;
  }
  return normalizedStatus;
}

function normalizeAdminNote(value) {
  return String(value || '').trim();
}

function normalizeDeliveryType(value) {
  const deliveryType = String(value || '').trim();
  return deliveryType || 'Por confirmar';
}

function normalizeDateNeeded(value) {
  const dateNeeded = String(value || '').trim();
  return dateNeeded || null;
}

function normalizeReferenceImages(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map(item => {
      if (typeof item === 'string') return { url: item, name: '' };
      return {
        url: String(item && item.url ? item.url : '').trim(),
        name: String(item && item.name ? item.name : '').trim()
      };
    })
    .filter(item => item.url)
    .slice(0, 6);
}

function normalizeCustomSummary(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    title: String(source.title || 'Pedido personalizado').trim().slice(0, 140),
    what: String(source.what || '').trim(),
    how: String(source.how || '').trim(),
    pieces: String(source.pieces || '').trim(),
    dateNeeded: String(source.dateNeeded || '').trim(),
    baseProduct: String(source.baseProduct || '').trim(),
    modifications: String(source.modifications || '').trim(),
    referenceImagesCount: Math.max(0, Number(source.referenceImagesCount || 0)),
    deliveryType: String(source.deliveryType || 'Por confirmar').trim() || 'Por confirmar',
    notesForAdmin: String(source.notesForAdmin || '').trim(),
    customerFriendlySummary: String(source.customerFriendlySummary || '').trim()
  };
}

function buildCustomOrderNotes(summary = {}, referenceImages = []) {
  const normalized = normalizeCustomSummary(summary);
  const lines = [
    normalized.customerFriendlySummary,
    normalized.what ? `Qué quiere: ${normalized.what}` : '',
    normalized.how ? `Cómo lo quiere: ${normalized.how}` : '',
    normalized.pieces ? `Cantidad/piezas: ${normalized.pieces}` : '',
    normalized.dateNeeded ? `Fecha solicitada: ${normalized.dateNeeded}` : '',
    normalized.baseProduct ? `Modelo base: ${normalized.baseProduct}` : '',
    normalized.modifications ? `Modificaciones: ${normalized.modifications}` : '',
    referenceImages.length ? `Referencias subidas: ${referenceImages.length}` : '',
    normalized.notesForAdmin ? `Notas para admin: ${normalized.notesForAdmin}` : ''
  ];

  return lines.filter(Boolean).join('\n');
}

function extractPiecesQuantity(summary = {}) {
  const pieces = String(summary.pieces || '').match(/\d+/);
  if (!pieces) return 1;
  return Math.max(1, Math.min(999, Number(pieces[0])));
}

function extractDateFromSummary(summary = {}) {
  const value = String(summary.dateNeeded || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function hasConfirmedDelivery(value) {
  const deliveryType = String(value || '').trim();
  return Boolean(deliveryType && deliveryType !== 'Por confirmar');
}

function hasConfirmedDate(value) {
  return Boolean(String(value || '').trim());
}

function assertOrderCanChangeStatus(order, nextStatus) {
  if (!order) return;

  const adminNote = normalizeAdminNote(order.adminNote || order.admin_note);
  const deliveryType = normalizeDeliveryType(order.deliveryType || order.delivery_type);
  const dateNeeded = normalizeDateNeeded(order.dateNeeded || order.date_needed);

  if (nextStatus === 'Pendiente de revisión') {
    return;
  }

  if (nextStatus === 'Cancelado') {
    if (!adminNote) {
      const error = new Error('Agrega una nota del admin para explicar la cancelación al cliente.');
      error.status = 400;
      throw error;
    }
    return;
  }

  const missing = [];
  if (!hasConfirmedDelivery(deliveryType)) missing.push('tipo de entrega');
  if (!hasConfirmedDate(dateNeeded)) missing.push('fecha solicitada');
  if (!adminNote) missing.push('nota del admin');

  if (missing.length) {
    const error = new Error(`Antes de cambiar el estado completa: ${missing.join(', ')}.`);
    error.status = 400;
    throw error;
  }
}

function cloneMemoryOrder(order) {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items.map(item => ({ ...item })) : []
  };
}

async function listOrders() {
  if (getMode() !== 'mysql') {
    return memoryOrders.map(order => ({
      ...cloneMemoryOrder(order),
      itemCount: Array.isArray(order.items) ? order.items.length : 0
    }));
  }

  const pool = getPool();
  const [orders] = await pool.execute(
    `SELECT o.id,
            o.order_number AS orderNumber,
            o.customer_user_id AS customerUserId,
            o.customer_name AS customerName,
            o.customer_email AS customerEmail,
            o.customer_phone AS customerPhone,
            o.delivery_type AS deliveryType,
            o.date_needed AS dateNeeded,
            o.notes,
            o.admin_note AS adminNote,
            o.status,
            o.subtotal_estimated AS subtotalEstimated,
            o.total_estimated AS totalEstimated,
            o.ai_summary AS aiSummary,
            o.created_at AS createdAt,
            o.updated_at AS updatedAt,
            u.name AS accountName,
            u.email AS accountEmail,
            u.phone AS accountPhone,
            COALESCE(items.itemCount, 0) AS itemCount
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_user_id
       LEFT JOIN (
          SELECT order_id, COUNT(*) AS itemCount
            FROM order_items
           GROUP BY order_id
       ) items ON items.order_id = o.id
      ORDER BY o.created_at DESC
      LIMIT 100`
  );

  return orders;
}

async function getOrderById(orderId) {
  if (!orderId) return null;

  if (getMode() !== 'mysql') {
    const order = memoryOrders.find(item => item.id === orderId || item.orderNumber === orderId);
    return order ? cloneMemoryOrder(order) : null;
  }

  const pool = getPool();
  const [orders] = await pool.execute(
    `SELECT o.id,
            o.order_number AS orderNumber,
            o.customer_user_id AS customerUserId,
            o.customer_name AS customerName,
            o.customer_email AS customerEmail,
            o.customer_phone AS customerPhone,
            o.delivery_type AS deliveryType,
            o.date_needed AS dateNeeded,
            o.notes,
            o.admin_note AS adminNote,
            o.status,
            o.subtotal_estimated AS subtotalEstimated,
            o.total_estimated AS totalEstimated,
            o.ai_summary AS aiSummary,
            o.ai_payload AS aiPayload,
            o.created_at AS createdAt,
            o.updated_at AS updatedAt,
            u.name AS accountName,
            u.email AS accountEmail,
            u.phone AS accountPhone
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_user_id
      WHERE o.id = ? OR o.order_number = ?
      LIMIT 1`,
    [orderId, orderId]
  );

  if (!orders.length) return null;

  const order = orders[0];
  order.aiPayload = parseJsonSafe(order.aiPayload, null);
  const [items] = await pool.execute(
    `SELECT id,
            order_id AS orderId,
            product_id AS productId,
            product_snapshot_json AS productSnapshotJson,
            quantity,
            unit_price_estimated AS unitPriceEstimated,
            line_total_estimated AS lineTotalEstimated,
            customization_notes AS customizationNotes,
            ai_customization_summary AS aiCustomizationSummary,
            ai_payload AS aiPayload,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM order_items
      WHERE order_id = ?
      ORDER BY created_at ASC`,
    [order.id]
  );

  order.items = items.map(item => ({
    ...item,
    productSnapshot: parseJsonSafe(item.productSnapshotJson, {}),
    aiPayload: parseJsonSafe(item.aiPayload, null)
  }));

  return order;
}


async function getOrderByIdForCustomer(orderId, customerUserId) {
  if (!orderId || !customerUserId) return null;

  if (getMode() !== 'mysql') {
    const order = memoryOrders.find(item =>
      (item.id === orderId || item.orderNumber === orderId) && item.customerUserId === customerUserId
    );
    return order ? cloneMemoryOrder(order) : null;
  }

  const pool = getPool();
  const [orders] = await pool.execute(
    `SELECT o.id,
            o.order_number AS orderNumber,
            o.customer_user_id AS customerUserId,
            o.customer_name AS customerName,
            o.customer_email AS customerEmail,
            o.customer_phone AS customerPhone,
            o.delivery_type AS deliveryType,
            o.date_needed AS dateNeeded,
            o.notes,
            o.admin_note AS adminNote,
            o.status,
            o.subtotal_estimated AS subtotalEstimated,
            o.total_estimated AS totalEstimated,
            o.ai_summary AS aiSummary,
            o.ai_payload AS aiPayload,
            o.created_at AS createdAt,
            o.updated_at AS updatedAt,
            u.name AS accountName,
            u.email AS accountEmail,
            u.phone AS accountPhone
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_user_id
      WHERE (o.id = ? OR o.order_number = ?)
        AND o.customer_user_id = ?
      LIMIT 1`,
    [orderId, orderId, customerUserId]
  );

  if (!orders.length) return null;

  const order = orders[0];
  order.aiPayload = parseJsonSafe(order.aiPayload, null);
  const [items] = await pool.execute(
    `SELECT id,
            order_id AS orderId,
            product_id AS productId,
            product_snapshot_json AS productSnapshotJson,
            quantity,
            unit_price_estimated AS unitPriceEstimated,
            line_total_estimated AS lineTotalEstimated,
            customization_notes AS customizationNotes,
            ai_customization_summary AS aiCustomizationSummary,
            ai_payload AS aiPayload,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM order_items
      WHERE order_id = ?
      ORDER BY created_at ASC`,
    [order.id]
  );

  order.items = items.map(item => ({
    ...item,
    productSnapshot: parseJsonSafe(item.productSnapshotJson, {}),
    aiPayload: parseJsonSafe(item.aiPayload, null)
  }));

  return order;
}

async function listOrdersByCustomer(customerUserId) {
  if (!customerUserId) return [];

  if (getMode() !== 'mysql') {
    return memoryOrders
      .filter(order => order.customerUserId === customerUserId)
      .map(order => cloneMemoryOrder(order));
  }

  const pool = getPool();
  const [orders] = await pool.execute(
    `SELECT o.id,
            o.order_number AS orderNumber,
            o.customer_user_id AS customerUserId,
            o.customer_name AS customerName,
            o.customer_email AS customerEmail,
            o.customer_phone AS customerPhone,
            o.delivery_type AS deliveryType,
            o.date_needed AS dateNeeded,
            o.notes,
            o.admin_note AS adminNote,
            o.status,
            o.subtotal_estimated AS subtotalEstimated,
            o.total_estimated AS totalEstimated,
            o.ai_summary AS aiSummary,
            o.created_at AS createdAt,
            o.updated_at AS updatedAt,
            COALESCE(items.itemCount, 0) AS itemCount
       FROM orders o
       LEFT JOIN (
          SELECT order_id, COUNT(*) AS itemCount
            FROM order_items
           GROUP BY order_id
       ) items ON items.order_id = o.id
      WHERE o.customer_user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 30`,
    [customerUserId]
  );

  return orders;
}

async function createOrder(input = {}) {
  const cartItems = Array.isArray(input.items) ? input.items : [];
  const id = createId();
  const orderNumber = normalizeOrderNumber(id);

  const normalizedItems = [];
  let subtotal = 0;

  for (const item of cartItems) {
    const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
    const product = await getProductBySlug(item.productId || item.id || item.slug, { includeHidden: false });
    if (!product) continue;

    const lineTotal = Number(product.price) * quantity;
    subtotal += lineTotal;

    normalizedItems.push({
      id: createId(),
      productId: product.id,
      productSnapshot: product,
      quantity,
      unitPriceEstimated: Number(product.price),
      lineTotalEstimated: lineTotal,
      customizationNotes: item.customizationNotes || ''
    });
  }

  if (!normalizedItems.length) {
    const error = new Error('El pedido no tiene productos válidos.');
    error.status = 400;
    throw error;
  }

  const customer = input.customer || {};
  const order = {
    id,
    orderNumber,
    customerUserId: input.customerUserId || customer.id || null,
    customerName: input.customerName || customer.name || 'Cliente sin nombre',
    customerEmail: input.customerEmail || customer.email || null,
    customerPhone: input.customerPhone || customer.phone || null,
    deliveryType: input.deliveryType || 'Por confirmar',
    dateNeeded: input.dateNeeded || null,
    notes: input.notes || '',
    adminNote: null,
    status: 'Pendiente de revisión',
    subtotalEstimated: subtotal,
    totalEstimated: subtotal,
    aiSummary: null,
    aiPayload: null,
    items: normalizedItems
  };

  if (getMode() !== 'mysql') {
    memoryOrders.unshift(order);
    return order;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO orders
        (id, order_number, customer_user_id, customer_name, customer_email, customer_phone, delivery_type, date_needed, notes, status, subtotal_estimated, total_estimated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.orderNumber,
        order.customerUserId,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.deliveryType,
        order.dateNeeded || null,
        order.notes,
        order.status,
        order.subtotalEstimated,
        order.totalEstimated
      ]
    );

    for (const item of normalizedItems) {
      await connection.execute(
        `INSERT INTO order_items
          (id, order_id, product_id, product_snapshot_json, quantity, unit_price_estimated, line_total_estimated, customization_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          order.id,
          item.productId,
          JSON.stringify(item.productSnapshot),
          item.quantity,
          item.unitPriceEstimated,
          item.lineTotalEstimated,
          item.customizationNotes
        ]
      );
    }

    await connection.commit();
    return order;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


async function createCustomOrder(input = {}) {
  const id = createId();
  const orderNumber = normalizeOrderNumber(id);
  const customer = input.customer || {};
  const summary = normalizeCustomSummary(input.summary);
  const referenceImages = normalizeReferenceImages(input.referenceImages);
  const selectedProduct = input.selectedProductId
    ? await getProductBySlug(input.selectedProductId, { includeHidden: false })
    : null;

  const notes = buildCustomOrderNotes(summary, referenceImages);
  const quantity = extractPiecesQuantity(summary);
  const title = summary.title || (selectedProduct ? `Personalización de ${selectedProduct.name}` : 'Pedido personalizado');
  const snapshot = selectedProduct ? {
    ...selectedProduct,
    name: title,
    baseProductName: selectedProduct.name,
    customOrder: true,
    referenceImages
  } : {
    id: 'custom-order-request',
    slug: 'pedido-personalizado',
    name: title,
    category: 'Personalizado',
    price: 0,
    measures: 'Por confirmar',
    material: 'Por confirmar',
    time: 'Por confirmar',
    stock: 'Bajo pedido',
    status: 'Publicado',
    personalizable: 'Sí',
    specs: ['Cotización por confirmar', 'Pedido personalizado'],
    detail: summary.customerFriendlySummary || summary.what || 'Solicitud personalizada.',
    image: referenceImages[0]?.url || undefined,
    customOrder: true,
    referenceImages
  };

  const order = {
    id,
    orderNumber,
    customerUserId: input.customerUserId || customer.id || null,
    customerName: input.customerName || customer.name || 'Cliente sin nombre',
    customerEmail: input.customerEmail || customer.email || null,
    customerPhone: input.customerPhone || customer.phone || null,
    deliveryType: summary.deliveryType || input.deliveryType || 'Por confirmar',
    dateNeeded: input.dateNeeded || extractDateFromSummary(summary),
    notes,
    adminNote: null,
    status: 'Pendiente de revisión',
    subtotalEstimated: 0,
    totalEstimated: 0,
    aiSummary: summary.notesForAdmin || summary.customerFriendlySummary || notes,
    aiPayload: {
      type: 'custom_order_request',
      summary,
      referenceImages,
      selectedProductId: selectedProduct ? selectedProduct.id : null,
      selectedProductSlug: selectedProduct ? selectedProduct.slug : null,
      messages: Array.isArray(input.messages) ? input.messages.slice(-20) : []
    },
    items: [
      {
        id: createId(),
        productId: selectedProduct ? selectedProduct.id : null,
        productSnapshot: snapshot,
        quantity,
        unitPriceEstimated: 0,
        lineTotalEstimated: 0,
        customizationNotes: notes,
        aiCustomizationSummary: summary.notesForAdmin || summary.customerFriendlySummary || notes,
        aiPayload: {
          type: 'custom_order_item',
          summary,
          referenceImages
        },
        status: 'Pendiente'
      }
    ]
  };

  if (getMode() !== 'mysql') {
    memoryOrders.unshift(order);
    return cloneMemoryOrder(order);
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO orders
        (id, order_number, customer_user_id, customer_name, customer_email, customer_phone, delivery_type, date_needed, notes, status, subtotal_estimated, total_estimated, ai_summary, ai_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.orderNumber,
        order.customerUserId,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.deliveryType,
        order.dateNeeded || null,
        order.notes,
        order.status,
        order.subtotalEstimated,
        order.totalEstimated,
        order.aiSummary,
        JSON.stringify(order.aiPayload)
      ]
    );

    for (const item of order.items) {
      await connection.execute(
        `INSERT INTO order_items
          (id, order_id, product_id, product_snapshot_json, quantity, unit_price_estimated, line_total_estimated, customization_notes, ai_customization_summary, ai_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          order.id,
          item.productId,
          JSON.stringify(item.productSnapshot),
          item.quantity,
          item.unitPriceEstimated,
          item.lineTotalEstimated,
          item.customizationNotes,
          item.aiCustomizationSummary,
          JSON.stringify(item.aiPayload)
        ]
      );
    }

    await connection.commit();
    return getOrderById(order.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrderAdminDetails(orderId, input = {}) {
  if (!orderId) return null;

  const deliveryType = normalizeDeliveryType(input.deliveryType);
  const dateNeeded = normalizeDateNeeded(input.dateNeeded);
  const adminNote = normalizeAdminNote(input.adminNote);

  if (getMode() !== 'mysql') {
    const order = memoryOrders.find(item => item.id === orderId || item.orderNumber === orderId);
    if (!order) return null;
    order.deliveryType = deliveryType;
    order.dateNeeded = dateNeeded;
    order.adminNote = adminNote;
    order.updatedAt = new Date().toISOString();
    return cloneMemoryOrder(order);
  }

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE orders
        SET delivery_type = ?,
            date_needed = ?,
            admin_note = ?
      WHERE id = ? OR order_number = ?`,
    [deliveryType, dateNeeded, adminNote, orderId, orderId]
  );

  if (!result.affectedRows) return null;
  return getOrderById(orderId);
}

async function updateOrderStatus(orderId, status) {
  const nextStatus = assertValidStatus(status);

  if (getMode() !== 'mysql') {
    const order = memoryOrders.find(item => item.id === orderId || item.orderNumber === orderId);
    if (!order) return null;
    assertOrderCanChangeStatus(order, nextStatus);
    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();
    return cloneMemoryOrder(order);
  }

  const currentOrder = await getOrderById(orderId);
  if (!currentOrder) return null;
  assertOrderCanChangeStatus(currentOrder, nextStatus);

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE orders
        SET status = ?
      WHERE id = ? OR order_number = ?`,
    [nextStatus, orderId, orderId]
  );

  if (!result.affectedRows) return null;
  return getOrderById(orderId);
}


module.exports = {
  ORDER_STATUSES,
  listOrders,
  getOrderById,
  getOrderByIdForCustomer,
  listOrdersByCustomer,
  createOrder,
  createCustomOrder,
  updateOrderAdminDetails,
  updateOrderStatus
};
