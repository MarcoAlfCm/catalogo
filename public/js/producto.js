const params = new URLSearchParams(window.location.search);
const pathParts = window.location.pathname.split('/').filter(Boolean);
const slug = pathParts[pathParts.length - 1] || params.get('slug');
let product = null;
let cart = getCart();

function renderProductDetail() {
  const container = document.getElementById('productDetail');
  if (!container) return;

  if (!product) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:1rem;">
        <i class="fa-regular fa-folder-open"></i>
        No encontramos este producto. Vuelve al catálogo para elegir otra pieza.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <section class="detail-layout">
      <div class="detail-gallery">
        <img src="${escapeHtml(product.image || defaultImage)}" alt="${escapeHtml(product.name)}">
      </div>
      <article class="panel-card detail-info">
        <a class="btn-ghost" href="/catalogo"><i class="fa-solid fa-arrow-left"></i> Volver al catálogo</a>
        <h1 class="detail-title">${escapeHtml(product.name)}</h1>
        <div class="detail-price">${money(product.price)}</div>
        <p class="detail-copy">${escapeHtml(product.detail)}</p>

        <div class="specs-row">
          ${product.specs.map(spec => `<span class="spec-chip">${escapeHtml(spec)}</span>`).join('')}
        </div>

        <div class="info-grid">
          <div class="info-tile"><span>Categoría</span><strong>${escapeHtml(product.category)}</strong></div>
          <div class="info-tile"><span>Disponibilidad</span><strong>${escapeHtml(product.stock)}</strong></div>
          <div class="info-tile"><span>Medidas</span><strong>${escapeHtml(product.measures)}</strong></div>
          <div class="info-tile"><span>Material</span><strong>${escapeHtml(product.material)}</strong></div>
          <div class="info-tile"><span>Elaboración</span><strong>${escapeHtml(product.time)}</strong></div>
          <div class="info-tile"><span>Personalizable</span><strong>${escapeHtml(product.personalizable)}</strong></div>
        </div>

        <div class="notice-box" style="margin: 1rem 0;">
          <i class="fa-solid fa-circle-info"></i>
          <span>El precio es estimado. Puede cambiar si solicitas tamaño, color o detalle personalizado especial.</span>
        </div>

        <div class="card-actions detail-actions" style="grid-template-columns: 132px 1fr;">
          <div class="qty-control" aria-label="Cantidad">
            <button type="button" onclick="changeDetailQty(-1)">−</button>
            <span id="detailQty">1</span>
            <button type="button" onclick="changeDetailQty(1)">+</button>
          </div>
          <button class="btn-primary" type="button" onclick="addDetailToCart()"><i class="fa-solid fa-plus"></i> Agregar al pedido</button>
          <a class="btn-soft detail-custom-link" href="/personalizado?base=${encodeURIComponent(product.slug || product.id)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Usar como base personalizada</a>
        </div>
      </article>
    </section>
  `;
}

function changeDetailQty(delta) {
  const qtyElement = document.getElementById('detailQty');
  const current = Number(qtyElement?.textContent || 1);
  const next = Math.max(1, current + delta);
  if (qtyElement) qtyElement.textContent = next;
}

function addDetailToCart() {
  if (!product) return;
  const qty = Number(document.getElementById('detailQty')?.textContent || 1);
  cart[product.id] = Number(cart[product.id] || 0) + qty;
  saveCart(cart);
  alert('Producto agregado al pedido. Puedes volver al catálogo o continuar al pedido.');
}

async function initProductDetail() {
  const container = document.getElementById('productDetail');
  if (container) {
    container.innerHTML = '<div class="empty-state" style="margin-top:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando producto...</div>';
  }

  product = await loadProductBySlug(slug);
  renderProductDetail();
}

document.addEventListener('click', closeCustomerMenu);
renderCustomerMenu({ loginNext: '/cuenta' });
initProductDetail();
