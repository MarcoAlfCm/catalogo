const state = {
  products: [],
  cart: getCart(),
  search: '',
  category: 'Todo'
};

function filteredProducts() {
  const term = state.search.trim().toLowerCase();
  return state.products.filter(product => {
    const matchesCategory = state.category === 'Todo' || product.category === state.category;
    const haystack = [
      product.name,
      product.category,
      product.material,
      product.measures,
      product.detail,
      product.specs.join(' ')
    ].join(' ').toLowerCase();
    return matchesCategory && (!term || haystack.includes(term));
  });
}

function getCartTotalItems() {
  return Object.values(state.cart).reduce((acc, qty) => acc + Math.max(0, Number(qty) || 0), 0);
}

function syncMobileCatalogChrome() {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const isScrolled = window.scrollY > 90;
  const hasCartItems = getCartTotalItems() > 0;

  document.body.classList.toggle('catalog-mobile-scrolled', isMobile && isScrolled);
  document.body.classList.toggle('catalog-has-cart', hasCartItems);

  if (isMobile && isScrolled && !hasCartItems) {
    closeCart();
  }
}

function renderCategories() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  categoryList.innerHTML = getCategories(state.products).map(category => {
    const count = category === 'Todo'
      ? state.products.length
      : state.products.filter(product => product.category === category).length;

    return `
      <button class="category-filter ${state.category === category ? 'active' : ''}" type="button" onclick="setCategory('${escapeHtml(category)}')">
        <span>${escapeHtml(category)}</span>
        <small>${count}</small>
      </button>
    `;
  }).join('');
}

function renderCatalog() {
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogCounter = document.getElementById('catalogCounter');
  const resultHint = document.getElementById('resultHint');
  if (!catalogGrid) return;

  const products = filteredProducts();

  if (catalogCounter) catalogCounter.textContent = `${state.products.length} piezas`;
  if (resultHint) resultHint.textContent = `${products.length} resultado${products.length === 1 ? '' : 's'} visibles`;

  if (!products.length) {
    catalogGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        No encontramos piezas con ese filtro. Cambia la búsqueda o vuelve a ver todo el catálogo.
      </div>
    `;
    return;
  }

  catalogGrid.innerHTML = products.map(product => {
    const safeId = escapeHtml(product.id);
    const qty = Number(state.cart[product.id] || 1);

    return `
      <article class="product-card catalog-product-card">
        <div class="product-img">
          <img src="${escapeHtml(product.image || defaultImage)}" alt="${escapeHtml(product.name)}">
        </div>
        <div class="product-body">
          <div class="product-title-row">
            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            <span class="product-price"><small>$</small>${escapeHtml(product.price)}</span>
          </div>
          <p class="product-detail">${escapeHtml(product.detail)}</p>
          <div class="product-badge-row">
            <span class="category-chip"><i class="fa-solid fa-tag"></i>${escapeHtml(product.category)}</span>
            <span class="status-chip"><i class="fa-solid fa-circle-check"></i>${escapeHtml(product.stock)}</span>
            <span class="status-chip status-chip-custom"><i class="fa-solid fa-wand-magic-sparkles"></i>Personalizable: ${escapeHtml(product.personalizable)}</span>
          </div>
          <div class="meta-stack">
            <span><i class="fa-solid fa-ruler-combined"></i>${escapeHtml(product.measures)}</span>
            <span><i class="fa-solid fa-layer-group"></i>${escapeHtml(product.material)}</span>
            <span><i class="fa-regular fa-clock"></i>${escapeHtml(product.time)}</span>
          </div>
          <div class="specs-row">
            ${product.specs.slice(0, 3).map(spec => `<span class="spec-chip">${escapeHtml(spec)}</span>`).join('')}
          </div>
          <div class="card-actions">
            <div class="qty-control" aria-label="Cantidad">
              <button type="button" onclick="changeQty('${safeId}', -1)">−</button>
              <span id="qty-${safeId}">${qty}</span>
              <button type="button" onclick="changeQty('${safeId}', 1)">+</button>
            </div>
            <button class="btn-primary" type="button" onclick="addToCart('${safeId}')"><i class="fa-solid fa-plus"></i> Agregar</button>
          </div>
          <a class="btn-soft product-link" href="/producto/${escapeHtml(product.slug)}"><i class="fa-regular fa-eye"></i> Ver detalle</a>
        </div>
      </article>
    `;
  }).join('');
}

function renderCart() {
  const quoteList = document.getElementById('quoteList');
  const quoteCount = document.getElementById('quoteCount');
  const cartButtonCount = document.getElementById('cartButtonCount');
  const mobileCartFloatCount = document.getElementById('mobileCartFloatCount');
  const subtotalText = document.getElementById('subtotalText');
  const totalText = document.getElementById('totalText');
  if (!quoteList) return;

  const entries = Object.entries(state.cart).filter(([, qty]) => Number(qty) > 0);
  const totalItems = entries.reduce((acc, [, qty]) => acc + Number(qty), 0);
  const subtotal = entries.reduce((acc, [id, qty]) => {
    const product = state.products.find(item => item.id === id);
    return product ? acc + (product.price * Number(qty)) : acc;
  }, 0);

  if (quoteCount) quoteCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  if (cartButtonCount) cartButtonCount.textContent = totalItems;
  if (mobileCartFloatCount) mobileCartFloatCount.textContent = totalItems;
  if (subtotalText) subtotalText.textContent = money(subtotal);
  if (totalText) totalText.textContent = money(subtotal).replace('MXN', '').trim();
  syncMobileCatalogChrome();

  if (!entries.length) {
    quoteList.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-clipboard"></i>
        Agrega piezas del catálogo. La cotización queda guardada mientras navegas.
      </div>
    `;
    closeCart();
    return;
  }

  quoteList.innerHTML = entries.map(([id, qty], index) => {
    const product = state.products.find(item => item.id === id);
    if (!product) return '';

    return `
      ${index > 0 ? '<hr class="divider-light">' : ''}
      <div class="quote-item">
        <div class="quote-thumb"><img src="${escapeHtml(product.image || defaultImage)}" alt="${escapeHtml(product.name)}"></div>
        <div class="quote-info">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${qty} × ${money(product.price)} · ${escapeHtml(product.measures)}</span>
        </div>
        <span class="quote-price">${money(product.price * qty)}</span>
        <button class="quote-remove" type="button" onclick="removeFromCart('${escapeHtml(product.id)}')"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;
  }).join('');
}

function setCategory(category) {
  state.category = category;
  renderCategories();
  renderCatalog();
}

function changeQty(id, delta) {
  const element = document.getElementById(`qty-${id}`);
  const current = Number(element?.textContent || 1);
  const next = Math.max(1, current + delta);
  if (element) element.textContent = next;
}

function addToCart(id) {
  const qty = Number(document.getElementById(`qty-${id}`)?.textContent || 1);
  state.cart[id] = Number(state.cart[id] || 0) + qty;
  saveCart(state.cart);
  renderCart();
  openCart();
}

function removeFromCart(id) {
  delete state.cart[id];
  saveCart(state.cart);
  renderCart();
  renderCatalog();
}

function openCart() {
  const cartPopover = document.getElementById('cartPopover');
  const cartToggle = document.getElementById('cartToggle');
  if (!cartPopover || !cartToggle) return;
  cartPopover.classList.add('open');
  const mobileCartFloat = document.getElementById('mobileCartFloat');
  cartToggle.classList.add('active');
  cartToggle.setAttribute('aria-expanded', 'true');
  if (mobileCartFloat) mobileCartFloat.setAttribute('aria-expanded', 'true');
}

function closeCart() {
  const cartPopover = document.getElementById('cartPopover');
  const cartToggle = document.getElementById('cartToggle');
  if (!cartPopover || !cartToggle) return;
  cartPopover.classList.remove('open');
  const mobileCartFloat = document.getElementById('mobileCartFloat');
  cartToggle.classList.remove('active');
  cartToggle.setAttribute('aria-expanded', 'false');
  if (mobileCartFloat) mobileCartFloat.setAttribute('aria-expanded', 'false');
}

function toggleCart() {
  const cartPopover = document.getElementById('cartPopover');
  if (!cartPopover) return;

  if (getCartTotalItems() <= 0) {
    closeCart();
    return;
  }

  if (cartPopover.classList.contains('open')) closeCart();
  else openCart();
}

function goToPedido() {
  const entries = Object.entries(state.cart).filter(([, qty]) => Number(qty) > 0);
  if (!entries.length) {
    alert('Primero agrega productos para formar tu pedido.');
    return;
  }
  window.location.href = '/pedido';
}

async function initCatalog() {
  const catalogGrid = document.getElementById('catalogGrid');
  if (catalogGrid) {
    catalogGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Cargando catálogo...</div>';
  }

  state.products = await loadProducts({ includeHidden: false });
  renderCategories();
  renderCatalog();
  renderCart();
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', event => {
    state.search = event.target.value;
    renderCatalog();
  });
}

const cartToggle = document.getElementById('cartToggle');
if (cartToggle) {
  cartToggle.addEventListener('click', event => {
    event.stopPropagation();
    toggleCart();
  });
}


const mobileCartFloat = document.getElementById('mobileCartFloat');
if (mobileCartFloat) {
  mobileCartFloat.addEventListener('click', event => {
    event.stopPropagation();
    toggleCart();
  });
}

const cartPopover = document.getElementById('cartPopover');
if (cartPopover) {
  cartPopover.addEventListener('click', event => event.stopPropagation());
}

document.addEventListener('click', function() {
  closeCart();
  closeCustomerMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeCart();
});

let mobileCatalogChromeTicking = false;
function requestMobileCatalogChromeSync() {
  if (mobileCatalogChromeTicking) return;
  mobileCatalogChromeTicking = true;
  window.requestAnimationFrame(() => {
    syncMobileCatalogChrome();
    mobileCatalogChromeTicking = false;
  });
}

window.addEventListener('scroll', requestMobileCatalogChromeSync, { passive: true });
window.addEventListener('resize', requestMobileCatalogChromeSync);

const quoteBtn = document.getElementById('quoteBtn');
if (quoteBtn) quoteBtn.addEventListener('click', goToPedido);

renderCustomerMenu({ active: 'catalogo', loginNext: '/cuenta' });
initCatalog();
