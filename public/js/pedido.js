let products = [];
let cart = getCart();
let customerSession = null;

function redirectToLogin() {
  window.location.href = `/login?next=${encodeURIComponent('/pedido')}`;
}

async function loadCustomerSession() {
  const response = await fetch('/api/auth/customer/me', { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    redirectToLogin();
    return null;
  }

  return data.user;
}

function renderCustomerSession() {
  const text = document.getElementById('customerSessionText');
  if (!text || !customerSession) return;

  text.textContent = `Pedido ligado a ${customerSession.name || 'cliente'} · ${customerSession.email || 'sin correo'}`;

  const nameInput = document.getElementById('clientName');
  const phoneInput = document.getElementById('clientPhone');

  if (nameInput && !nameInput.value) nameInput.value = customerSession.name || '';
  if (phoneInput && !phoneInput.value) phoneInput.value = customerSession.phone || '';
}

function getOrderEntries() {
  return Object.entries(cart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([id, qty]) => {
      const product = products.find(item => item.id === id);
      return product ? { product, quantity: Number(qty) } : null;
    })
    .filter(Boolean);
}

function renderPedido() {
  const list = document.getElementById('orderList');
  const total = document.getElementById('orderTotal');
  const count = document.getElementById('orderCount');
  if (!list) return;

  const entries = getOrderEntries();
  const subtotal = entries.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  if (count) count.textContent = `${entries.length} producto${entries.length === 1 ? '' : 's'}`;
  if (total) total.textContent = money(subtotal);

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-clipboard"></i>
        Tu pedido está vacío. Vuelve al catálogo para elegir piezas.
      </div>
    `;
    return;
  }

  list.innerHTML = entries.map(item => `
    <div class="order-row">
      <img src="${escapeHtml(item.product.image || defaultImage)}" alt="${escapeHtml(item.product.name)}">
      <div>
        <strong>${escapeHtml(item.product.name)}</strong>
        <span>${item.quantity} × ${money(item.product.price)} · ${escapeHtml(item.product.measures)}</span>
      </div>
      <strong>${money(item.product.price * item.quantity)}</strong>
    </div>
  `).join('');
}

async function confirmPedido(event) {
  event.preventDefault();

  const entries = getOrderEntries();
  if (!entries.length) {
    alert('El pedido está vacío. Agrega productos antes de confirmar.');
    return;
  }

  if (!customerSession) {
    redirectToLogin();
    return;
  }

  const button = event.submitter;
  const originalText = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando pedido...';
  }

  try {
    const notes = document.getElementById('orderNotes').value;
    const order = await createOrderRequest({
      customerName: document.getElementById('clientName').value || customerSession.name,
      customerPhone: document.getElementById('clientPhone').value || customerSession.phone,
      customerEmail: customerSession.email,
      deliveryType: document.getElementById('deliveryType').value,
      dateNeeded: document.getElementById('dateNeeded').value,
      notes,
      items: entries.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        customizationNotes: notes
      }))
    });

    clearCart();
    cart = {};
    renderPedido();
    alert(`Pedido creado: ${order.orderNumber || 'pendiente'}\nEstado: Pendiente de revisión.`);
    window.location.href = '/catalogo';
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('sesión') || String(error.message || '').toLowerCase().includes('iniciar sesión')) {
      redirectToLogin();
      return;
    }
    alert(error.message || 'No se pudo crear el pedido.');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

async function logoutCustomer() {
  try {
    await fetch('/api/auth/customer/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    redirectToLogin();
  }
}

async function initPedido() {
  await renderCustomerMenu({ active: 'pedido', loginNext: '/pedido' });
  customerSession = await loadCustomerSession();
  if (!customerSession) return;

  renderCustomerSession();
  products = await loadProducts({ includeHidden: false });
  renderPedido();
}

document.getElementById('orderForm')?.addEventListener('submit', confirmPedido);
document.getElementById('customerLogoutBtn')?.addEventListener('click', logoutCustomer);
initPedido();
