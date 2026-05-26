let currentCustomerOrder = null;

function getCustomerOrderIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[2] || '');
}

function formatCustomerDate(value, fallback = 'Por confirmar') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  });
}

function formatCustomerDateTime(value) {
  if (!value) return 'Fecha por confirmar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getSnapshot(item = {}) {
  return item.productSnapshot || item.product_snapshot || {};
}

function renderCustomerOrderItems(items = []) {
  if (!items.length) {
    return `
      <div class="empty-state compact-empty">
        <i class="fa-regular fa-circle-question"></i>
        Este pedido no tiene productos visibles.
      </div>
    `;
  }

  return items.map(item => {
    const snapshot = getSnapshot(item);
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPriceEstimated || item.unit_price_estimated || snapshot.price || 0);
    const lineTotal = Number(item.lineTotalEstimated || item.line_total_estimated || unitPrice * quantity);
    const image = snapshot.image || defaultImage;

    return `
      <article class="customer-order-item">
        <div class="customer-order-item-img">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(snapshot.name || 'Producto del pedido')}">
        </div>
        <div class="customer-order-item-body">
          <div class="customer-order-item-head">
            <div>
              <strong>${escapeHtml(snapshot.name || 'Producto del pedido')}</strong>
              <span>${escapeHtml(snapshot.category || 'Manualidades')}</span>
            </div>
            <strong class="customer-order-item-total">${money(lineTotal)}</strong>
          </div>
          <div class="customer-order-item-meta">
            <span><i class="fa-solid fa-layer-group"></i> ${quantity} pieza${quantity === 1 ? '' : 's'}</span>
            <span><i class="fa-solid fa-tag"></i> ${money(unitPrice)} c/u</span>
            <span><i class="fa-solid fa-ruler-combined"></i> ${escapeHtml(snapshot.measures || 'Medidas por confirmar')}</span>
            <span><i class="fa-solid fa-cube"></i> ${escapeHtml(snapshot.material || 'Material por confirmar')}</span>
          </div>
          ${item.customizationNotes ? `<p class="customer-item-note"><strong>Nota de personalización:</strong> ${escapeHtml(item.customizationNotes)}</p>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderCustomerOrderDetail(order) {
  const panel = document.getElementById('customerOrderDetailPanel');
  if (!panel) return;

  const status = order.status || 'Pendiente de revisión';
  const adminNote = order.adminNote || order.admin_note || '';
  const itemCount = Array.isArray(order.items) ? order.items.reduce((acc, item) => acc + Number(item.quantity || 0), 0) : 0;

  panel.innerHTML = `
    <div class="customer-order-detail-head">
      <div>
        <a class="back-link" href="/cuenta#ordersPanel"><i class="fa-solid fa-arrow-left"></i> Volver a mis pedidos</a>
        <span class="mini-badge"><i class="fa-regular fa-clipboard"></i> Pedido</span>
        <h1>${escapeHtml(order.orderNumber || 'Pedido')}</h1>
        <p class="panel-subtitle">Creado el ${escapeHtml(formatCustomerDateTime(order.createdAt))}. El admin confirma precio final, tiempos y entrega.</p>
      </div>
      <div class="customer-order-status-box">
        <em class="status-pill status-${escapeHtml(slugify(status))}">${escapeHtml(status)}</em>
        <strong>${money(order.totalEstimated || 0)}</strong>
      </div>
    </div>

    <div class="customer-order-detail-grid">
      <article class="customer-detail-card">
        <span>Fecha solicitada</span>
        <strong>${escapeHtml(formatCustomerDate(order.dateNeeded))}</strong>
      </article>
      <article class="customer-detail-card">
        <span>Tipo de entrega</span>
        <strong>${escapeHtml(order.deliveryType || 'Por confirmar')}</strong>
      </article>
      <article class="customer-detail-card">
        <span>Piezas solicitadas</span>
        <strong>${itemCount}</strong>
      </article>
      <article class="customer-detail-card">
        <span>Total estimado</span>
        <strong>${money(order.totalEstimated || 0)}</strong>
      </article>
    </div>

    <section class="customer-order-section">
      <header class="customer-section-head">
        <div>
          <h2><i class="fa-solid fa-box-open"></i> Productos del pedido</h2>
          <p class="panel-subtitle">Revisa cantidades, materiales y subtotal de cada pieza.</p>
        </div>
      </header>
      <div class="customer-order-items">
        ${renderCustomerOrderItems(order.items || [])}
      </div>
    </section>

    <section class="customer-order-section customer-order-notes-grid">
      <article class="customer-note-card">
        <h2><i class="fa-regular fa-message"></i> Tus notas</h2>
        <p>${escapeHtml(order.notes || 'No agregaste notas para este pedido.')}</p>
      </article>
      <article class="customer-note-card subtle-note-card ${adminNote ? 'admin-note-visible' : ''}">
        <h2><i class="fa-solid ${adminNote ? 'fa-reply' : 'fa-circle-info'}"></i> ${adminNote ? 'Mensaje del taller' : 'Siguiente paso'}</h2>
        <p>${escapeHtml(adminNote || 'El taller revisará disponibilidad, tiempos y detalles. Cuando cambie el estado, lo verás reflejado en tu cuenta.')}</p>
      </article>
    </section>
  `;
}

function renderCustomerOrderError(message) {
  const panel = document.getElementById('customerOrderDetailPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="empty-state">
      <i class="fa-regular fa-circle-xmark"></i>
      ${escapeHtml(message || 'No se pudo cargar este pedido.')}
      <a class="btn-soft" href="/cuenta#ordersPanel" style="margin-top:1rem;">Volver a mi cuenta</a>
    </div>
  `;
}

async function initCustomerOrderDetail() {
  const user = await renderCustomerMenu({ active: 'cuenta', loginNext: window.location.pathname });
  if (!user) {
    window.location.href = getCustomerLoginUrl(window.location.pathname);
    return;
  }

  const orderId = getCustomerOrderIdFromPath();
  if (!orderId) {
    renderCustomerOrderError('Pedido no especificado.');
    return;
  }

  try {
    currentCustomerOrder = await loadCustomerOrderDetail(orderId);
    if (!currentCustomerOrder) {
      renderCustomerOrderError('Pedido no encontrado.');
      return;
    }
    renderCustomerOrderDetail(currentCustomerOrder);
  } catch (error) {
    renderCustomerOrderError(error.message || 'No se pudo cargar este pedido.');
  }
}

document.addEventListener('click', closeCustomerMenu);
initCustomerOrderDetail();
