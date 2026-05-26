const STORAGE_KEY = 'catalogo_manualidades_productos_preview_oficial_v4_fallback';
const CART_KEY = 'catalogo_manualidades_carrito_preview_oficial_v4';
const API_BASE = '/api';

const defaultImage = 'https://images.unsplash.com/photo-1516685304081-de7947d419d0?w=900&auto=format&fit=crop&q=80';

const defaultProducts = [
  {
    id: 'demo-resina-001',
    slug: 'llavero-personalizado-resina',
    name: 'Llavero personalizado en resina',
    category: 'Resina',
    price: 120,
    measures: '6 x 4 cm',
    material: 'Resina epóxica',
    time: '2 a 3 días',
    stock: 'Bajo pedido',
    status: 'Publicado',
    personalizable: 'Sí',
    specs: ['Nombre incluido', 'Color a elegir', 'Acabado brillante'],
    detail: 'Pieza ligera para regalo, recuerdo o detalle personalizado. Puede llevar nombre, inicial o figura pequeña.',
    image: 'https://images.unsplash.com/photo-1631200869971-8e0c4e409017?w=900&auto=format&fit=crop&q=80'
  },
  {
    id: 'demo-3d-002',
    slug: 'figura-decorativa-3d',
    name: 'Figura decorativa 3D',
    category: 'Impresión 3D',
    price: 280,
    measures: '15 cm alto',
    material: 'PLA pintado a mano',
    time: '4 a 7 días',
    stock: 'Personalizado',
    status: 'Publicado',
    personalizable: 'Sí',
    specs: ['Ligera', 'Base incluida', 'Pintura mate'],
    detail: 'Figura decorativa hecha bajo pedido. El precio puede cambiar por tamaño, pintura o complejidad.',
    image: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=900&auto=format&fit=crop&q=80'
  },
  {
    id: 'demo-deco-003',
    slug: 'portavasos-artesanal-resina',
    name: 'Portavasos artesanal',
    category: 'Decoración',
    price: 95,
    measures: '10 x 10 cm',
    material: 'Resina y pigmentos',
    time: '2 días',
    stock: 'Disponible',
    status: 'Publicado',
    personalizable: 'Sí',
    specs: ['Antiderrapante', 'Set opcional', 'Brillante'],
    detail: 'Puede venderse individual o en paquete. Ideal para personalizar colores por temporada.',
    image: 'https://images.unsplash.com/photo-1602872030219-ad2b9a54315c?w=900&auto=format&fit=crop&q=80'
  },
  {
    id: 'demo-regalo-004',
    slug: 'caja-regalo-personalizada',
    name: 'Caja regalo personalizada',
    category: 'Personalizados',
    price: 350,
    measures: '20 x 15 x 8 cm',
    material: 'Cartón rígido, vinil y listón',
    time: '3 a 5 días',
    stock: 'Bajo pedido',
    status: 'Publicado',
    personalizable: 'Sí',
    specs: ['Nombre incluido', 'Tema a elegir', 'Empaque listo'],
    detail: 'Pensada para cumpleaños, aniversario o fechas especiales. Puede incluir detalles extra con costo adicional.',
    image: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=900&auto=format&fit=crop&q=80'
  }
];

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value) {
  return String(value || 'producto-artesanal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `producto-${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(Number(value || 0));
}

function normalizeProduct(product) {
  const name = product.name || 'Producto artesanal';
  return {
    id: product.id || createId(),
    slug: product.slug || slugify(name),
    name,
    category: product.category || 'Manualidades',
    price: Number(product.price || 0),
    measures: product.measures || 'Medidas por confirmar',
    material: product.material || 'Material por confirmar',
    time: product.time || 'Por confirmar',
    stock: product.stock || 'Por confirmar',
    status: product.status || 'Publicado',
    personalizable: product.personalizable || 'Sí',
    specs: Array.isArray(product.specs) && product.specs.length ? product.specs : ['Personalizable'],
    detail: product.detail || 'Detalle pendiente.',
    image: product.image || defaultImage
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'same-origin',
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || 'No se pudo completar la operación.');
  }
  return data;
}


function normalizeCategory(category) {
  return {
    id: category.id || createId(),
    name: category.name || 'Manualidades',
    slug: category.slug || slugify(category.name || 'manualidades'),
    status: category.status || 'Activo',
    productCount: Number(category.productCount ?? category.product_count ?? 0)
  };
}

async function loadCategories() {
  try {
    const data = await apiRequest('/catalog/categories');
    return Array.isArray(data.categories) ? data.categories.map(normalizeCategory) : [];
  } catch (error) {
    console.warn('API de categorías no disponible:', error.message);
    return getCategories(getFallbackProducts())
      .filter(category => category !== 'Todo')
      .map(name => normalizeCategory({ name, productCount: 1 }));
  }
}

function getFallbackProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProducts.map(normalizeProduct);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultProducts.map(normalizeProduct);
    return parsed.map(normalizeProduct);
  } catch (error) {
    console.warn('No se pudo leer el catálogo fallback:', error);
    return defaultProducts.map(normalizeProduct);
  }
}

function saveFallbackProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products.map(normalizeProduct)));
}

async function loadProducts(options = {}) {
  const includeHidden = options.includeHidden ? '?includeHidden=1' : '';
  try {
    const data = await apiRequest(`/catalog/products${includeHidden}`);
    return Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];
  } catch (error) {
    console.warn('API de productos no disponible. Se usa fallback local:', error.message);
    const products = getFallbackProducts();
    return options.includeHidden ? products : products.filter(product => product.status === 'Publicado');
  }
}

async function loadProductBySlug(slug) {
  try {
    const data = await apiRequest(`/catalog/products/${encodeURIComponent(slug)}`);
    return normalizeProduct(data.product);
  } catch (error) {
    console.warn('Producto desde API no disponible. Se usa fallback local:', error.message);
    return getFallbackProducts().find(product => product.slug === slug || product.id === slug) || null;
  }
}


async function loadCustomerOrders() {
  try {
    const data = await apiRequest('/customer/orders');
    return Array.isArray(data.orders) ? data.orders : [];
  } catch (error) {
    console.warn('No se pudieron cargar pedidos del cliente:', error.message);
    return [];
  }
}

async function loadCustomerOrderDetail(orderId) {
  if (!orderId) return null;

  try {
    const data = await apiRequest(`/customer/orders/${encodeURIComponent(orderId)}`);
    return data.order || null;
  } catch (error) {
    console.warn('No se pudo cargar el detalle del pedido del cliente:', error.message);
    throw error;
  }
}

async function loadOrders() {
  try {
    const data = await apiRequest('/admin/orders');
    return Array.isArray(data.orders) ? data.orders : [];
  } catch (error) {
    console.warn('API de pedidos no disponible:', error.message);
    return [];
  }
}

async function loadOrderDetail(orderId) {
  if (!orderId) return null;

  try {
    const data = await apiRequest(`/admin/orders/${encodeURIComponent(orderId)}`);
    return data.order || null;
  } catch (error) {
    console.warn('No se pudo cargar el detalle del pedido:', error.message);
    throw error;
  }
}

async function updateOrderDetailsRequest(orderId, payload = {}) {
  const data = await apiRequest(`/admin/orders/${encodeURIComponent(orderId)}/details`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return data.order || null;
}

async function updateOrderStatusRequest(orderId, status) {
  const data = await apiRequest(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });

  return data.order || null;
}

async function createProductRequest(formData) {
  const data = await apiRequest('/admin/products', {
    method: 'POST',
    body: formData
  });
  return normalizeProduct(data.product);
}

async function updateProductRequest(id, formData) {
  const data = await apiRequest(`/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: formData
  });
  return normalizeProduct(data.product);
}

async function deleteProductRequest(id) {
  await apiRequest(`/admin/products/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

async function resetDemoRequest() {
  const data = await apiRequest('/admin/demo/reset', {
    method: 'POST'
  });
  return Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];
}

async function createOrderRequest(payload) {
  const data = await apiRequest('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return data.order;
}


async function uploadCustomReferenceRequest(formData) {
  const data = await apiRequest('/custom-orders/reference', {
    method: 'POST',
    body: formData
  });
  return data.reference || null;
}

async function chatCustomOrderRequest(payload) {
  const data = await apiRequest('/custom-orders/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return data.result || null;
}

async function finalizeCustomOrderRequest(payload) {
  const data = await apiRequest('/custom-orders/finalize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return data.order || null;
}

function getCategories(products = []) {
  return ['Todo', ...Array.from(new Set(products.map(product => product.category).filter(Boolean))).sort()];
}

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('No se pudo leer el pedido temporal:', error);
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart || {}));
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
}


async function getCustomerSession() {
  try {
    const response = await fetch('/api/auth/customer/me', {
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) return null;
    return data.user || null;
  } catch (error) {
    console.warn('No se pudo validar sesión de cliente:', error.message);
    return null;
  }
}

function getCustomerLoginUrl(next = '/cuenta') {
  const safeNext = String(next || '/cuenta');
  if (!safeNext.startsWith('/') || safeNext.startsWith('//')) return '/login';
  return `/login?next=${encodeURIComponent(safeNext)}`;
}

function getCartItemCount(cart = getCart()) {
  return Object.values(cart || {}).reduce((acc, qty) => acc + Math.max(0, Number(qty || 0)), 0);
}

async function logoutCustomerSession() {
  await fetch('/api/auth/customer/logout', {
    method: 'POST',
    credentials: 'same-origin'
  });
}

function closeCustomerMenu() {
  const menu = document.getElementById('customerMenu');
  const button = document.getElementById('customerMenuToggle');
  if (!menu || !button) return;
  menu.classList.remove('open');
  button.setAttribute('aria-expanded', 'false');
}

function toggleCustomerMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('customerMenu');
  const button = document.getElementById('customerMenuToggle');
  if (!menu || !button) return;
  const isOpen = menu.classList.toggle('open');
  button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function customerInitials(user = {}) {
  const source = String(user.name || user.email || 'Cliente').trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'C';
}

async function renderCustomerMenu(options = {}) {
  const container = document.getElementById('customerMenu');
  if (!container) return null;

  const loginNext = options.loginNext || '/cuenta';
  const active = options.active || '';
  const user = await getCustomerSession();

  if (!user) {
    container.innerHTML = `
      <a class="user-login-pill" href="${getCustomerLoginUrl(loginNext)}">
        <i class="fa-regular fa-user"></i>
        Ingresar
      </a>
    `;
    return null;
  }

  container.innerHTML = `
    <button class="user-menu-toggle" type="button" id="customerMenuToggle" aria-expanded="false" aria-controls="customerMenuPanel">
      <span class="user-avatar">${escapeHtml(customerInitials(user))}</span>
      <span class="user-menu-name">${escapeHtml(user.name || 'Mi cuenta')}</span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    <div class="user-menu-panel" id="customerMenuPanel">
      <div class="user-menu-head">
        <strong>${escapeHtml(user.name || 'Cliente')}</strong>
        <span>${escapeHtml(user.email || '')}</span>
      </div>
      <a class="user-menu-item ${active === 'cuenta' ? 'active' : ''}" href="/cuenta"><i class="fa-regular fa-user"></i> Mi cuenta</a>
      <a class="user-menu-item ${active === 'pedido' ? 'active' : ''}" href="/pedido"><i class="fa-regular fa-clipboard"></i> Revisar pedido</a>
      <a class="user-menu-item ${active === 'personalizado' ? 'active' : ''}" href="/personalizado"><i class="fa-solid fa-wand-magic-sparkles"></i> Pedido personalizado</a>
      <button class="user-menu-item danger" type="button" id="customerHeaderLogout"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button>
    </div>
  `;

  const toggle = document.getElementById('customerMenuToggle');
  const logout = document.getElementById('customerHeaderLogout');
  toggle?.addEventListener('click', toggleCustomerMenu);
  logout?.addEventListener('click', async function() {
    try {
      await logoutCustomerSession();
    } finally {
      window.location.href = '/catalogo';
    }
  });

  return user;
}

