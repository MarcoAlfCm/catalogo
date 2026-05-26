const express = require('express');
const { getMode, getLastError } = require('../services/db');
const {
  uploadProductImage,
  uploadCustomReferenceImage,
  getUploadedImageUrl,
  getUploadedCustomReferenceUrl
} = require('../services/upload');
const { listCategories } = require('../repositories/categoryRepository');
const {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  archiveProduct,
  resetDemoProducts
} = require('../repositories/productRepository');
const {
  listOrders,
  getOrderById,
  getOrderByIdForCustomer,
  listOrdersByCustomer,
  createOrder,
  createCustomOrder,
  updateOrderAdminDetails,
  updateOrderStatus
} = require('../repositories/orderRepository');
const { requireAdminApi, requireCustomerApi } = require('../middleware/auth');
const { analyzeCustomOrder, normalizeMessages, normalizeReferenceImages } = require('../services/deepseekCustomOrder');

const router = express.Router();

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function productPayloadFromRequest(req) {
  const imageFromUpload = getUploadedImageUrl(req.file);

  return {
    name: req.body.name,
    category: req.body.category,
    price: req.body.price,
    measures: req.body.measures,
    material: req.body.material,
    time: req.body.time,
    stock: req.body.stock,
    status: req.body.status,
    personalizable: req.body.personalizable,
    specs: req.body.specs,
    detail: req.body.detail,
    image: imageFromUpload || req.body.image || req.body.currentImage
  };
}

router.get('/status', function(req, res) {
  res.json({
    ok: true,
    app: 'catalogo',
    storage: getMode(),
    dbWarning: getLastError(),
    env: process.env.NODE_ENV || 'development'
  });
});

router.get('/catalog/products', asyncHandler(async function(req, res) {
  const includeHidden = req.query.includeHidden === '1' || req.query.includeHidden === 'true';
  const products = await listProducts({ includeHidden });
  res.json({ ok: true, products });
}));

router.get('/catalog/products/:slug', asyncHandler(async function(req, res) {
  const product = await getProductBySlug(req.params.slug, { includeHidden: false });
  if (!product) {
    return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
  }
  res.json({ ok: true, product });
}));

router.get('/catalog/categories', asyncHandler(async function(req, res) {
  const categories = await listCategories();
  res.json({ ok: true, categories });
}));



router.get('/customer/orders', requireCustomerApi, asyncHandler(async function(req, res) {
  const orders = await listOrdersByCustomer(req.customerSession.sub);
  res.json({ ok: true, orders });
}));

router.get('/customer/orders/:id', requireCustomerApi, asyncHandler(async function(req, res) {
  const order = await getOrderByIdForCustomer(req.params.id, req.customerSession.sub);
  if (!order) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  res.json({ ok: true, order });
}));


router.post('/custom-orders/reference', requireCustomerApi, uploadCustomReferenceImage.single('referenceImage'), asyncHandler(async function(req, res) {
  const url = getUploadedCustomReferenceUrl(req.file);
  if (!url) {
    return res.status(400).json({ ok: false, message: 'Sube una imagen de referencia válida.' });
  }

  res.status(201).json({
    ok: true,
    reference: {
      url,
      name: req.file.originalname || 'referencia',
      size: req.file.size || 0,
      mimeType: req.file.mimetype || ''
    }
  });
}));

router.post('/custom-orders/chat', requireCustomerApi, asyncHandler(async function(req, res) {
  const selectedProductId = String(req.body.selectedProductId || '').trim();
  const selectedProduct = selectedProductId
    ? await getProductBySlug(selectedProductId, { includeHidden: false })
    : null;

  const result = await analyzeCustomOrder({
    messages: normalizeMessages(req.body.messages),
    referenceImages: normalizeReferenceImages(req.body.referenceImages),
    selectedProduct
  });

  res.json({ ok: true, result });
}));

router.post('/custom-orders/finalize', requireCustomerApi, asyncHandler(async function(req, res) {
  const selectedProductId = String(req.body.selectedProductId || '').trim();
  const selectedProduct = selectedProductId
    ? await getProductBySlug(selectedProductId, { includeHidden: false })
    : null;

  const analyzed = await analyzeCustomOrder({
    messages: normalizeMessages(req.body.messages),
    referenceImages: normalizeReferenceImages(req.body.referenceImages),
    selectedProduct
  });

  const summary = req.body.summary && Object.keys(req.body.summary).length
    ? req.body.summary
    : analyzed.summary;

  const order = await createCustomOrder({
    customerUserId: req.customerSession.sub,
    customer: {
      id: req.customerSession.sub,
      name: req.customerSession.name,
      email: req.customerSession.email,
      phone: req.customerSession.phone
    },
    selectedProductId: selectedProduct ? selectedProduct.id : null,
    referenceImages: normalizeReferenceImages(req.body.referenceImages),
    messages: normalizeMessages(req.body.messages),
    summary
  });

  res.status(201).json({ ok: true, order, ai: analyzed });
}));

router.use('/admin', requireAdminApi);

router.get('/admin/products', asyncHandler(async function(req, res) {
  const products = await listProducts({ includeHidden: true });
  res.json({ ok: true, products });
}));

router.post('/admin/products', uploadProductImage.single('imageFile'), asyncHandler(async function(req, res) {
  const product = await createProduct(productPayloadFromRequest(req));
  res.status(201).json({ ok: true, product });
}));

router.put('/admin/products/:id', uploadProductImage.single('imageFile'), asyncHandler(async function(req, res) {
  const product = await updateProduct(req.params.id, productPayloadFromRequest(req));
  if (!product) {
    return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
  }
  res.json({ ok: true, product });
}));

router.delete('/admin/products/:id', asyncHandler(async function(req, res) {
  const deleted = await archiveProduct(req.params.id);
  if (!deleted) {
    return res.status(404).json({ ok: false, message: 'Producto no encontrado.' });
  }
  res.json({ ok: true });
}));

router.post('/admin/demo/reset', asyncHandler(async function(req, res) {
  const products = await resetDemoProducts();
  res.json({ ok: true, products });
}));

router.get('/admin/orders', asyncHandler(async function(req, res) {
  const orders = await listOrders();
  res.json({ ok: true, orders });
}));

router.get('/admin/orders/:id', asyncHandler(async function(req, res) {
  const order = await getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  res.json({ ok: true, order });
}));


router.put('/admin/orders/:id/details', asyncHandler(async function(req, res) {
  const order = await updateOrderAdminDetails(req.params.id, {
    deliveryType: req.body.deliveryType,
    dateNeeded: req.body.dateNeeded,
    adminNote: req.body.adminNote
  });
  if (!order) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  res.json({ ok: true, order });
}));

router.put('/admin/orders/:id/status', asyncHandler(async function(req, res) {
  const order = await updateOrderStatus(req.params.id, req.body.status);
  if (!order) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  }
  res.json({ ok: true, order });
}));

router.post('/orders', requireCustomerApi, asyncHandler(async function(req, res) {
  const order = await createOrder({
    ...req.body,
    customerUserId: req.customerSession.sub,
    customer: {
      id: req.customerSession.sub,
      name: req.customerSession.name,
      email: req.customerSession.email,
      phone: req.customerSession.phone
    }
  });
  res.status(201).json({ ok: true, order });
}));

router.use(function(error, req, res, next) {
  console.error('[catalogo-api]', error);
  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    message: error.message || 'Error interno del catálogo.'
  });
});

module.exports = router;
