let accountUser = null;
let accountOrders = [];

function formatOrderDate(value) {
  if (!value) return 'Fecha por confirmar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function renderAccountHeader() {
  const title = document.getElementById('accountTitle');
  const subtitle = document.getElementById('accountSubtitle');
  const cartMetric = document.getElementById('cartMetric');
  const ordersMetric = document.getElementById('ordersMetric');

  if (title) title.textContent = `Hola, ${accountUser?.name || 'cliente'}`;
  if (subtitle) subtitle.textContent = `${accountUser?.email || ''}${accountUser?.phone ? ' · ' + accountUser.phone : ''}`;

  const cartCount = getCartItemCount();
  if (cartMetric) cartMetric.textContent = `${cartCount} producto${cartCount === 1 ? '' : 's'}`;
  if (ordersMetric) ordersMetric.textContent = accountOrders.length;
}

function renderOrders() {
  const list = document.getElementById('customerOrdersList');
  if (!list) return;

  if (!accountOrders.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-clipboard"></i>
        Todavía no tienes pedidos creados. El catálogo está listo cuando quieras empezar.
      </div>
    `;
    return;
  }

  list.innerHTML = accountOrders.map(order => {
    const orderId = encodeURIComponent(order.id || order.orderNumber || '');
    return `
      <a class="customer-order-card customer-order-link" href="/cuenta/pedido/${orderId}">
        <div>
          <strong>${escapeHtml(order.orderNumber || 'Pedido')}</strong>
          <span>${escapeHtml(formatOrderDate(order.createdAt))} · ${Number(order.itemCount || 0)} producto${Number(order.itemCount || 0) === 1 ? '' : 's'}</span>
        </div>
        <div class="customer-order-meta">
          <em class="status-pill status-${escapeHtml(slugify(order.status || 'Pendiente de revisión'))}">${escapeHtml(order.status || 'Pendiente de revisión')}</em>
          <strong>${money(order.totalEstimated || 0)}</strong>
          <i class="fa-solid fa-chevron-right customer-order-arrow" aria-hidden="true"></i>
        </div>
      </a>
    `;
  }).join('');
}

async function initCuenta() {
  accountUser = await renderCustomerMenu({ active: 'cuenta', loginNext: '/cuenta' });
  if (!accountUser) {
    window.location.href = getCustomerLoginUrl('/cuenta');
    return;
  }

  accountOrders = await loadCustomerOrders();
  renderAccountHeader();
  renderOrders();
}

document.addEventListener('click', closeCustomerMenu);
initCuenta();
