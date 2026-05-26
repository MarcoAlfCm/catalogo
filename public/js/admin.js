const ORDER_STATUSES = [
  'Pendiente de revisión',
  'Confirmado',
  'En elaboración',
  'Listo para entrega',
  'Entregado',
  'Cancelado'
];

const DELIVERY_TYPES = [
  'Por confirmar',
  'Recoger en punto acordado',
  'Envío local',
  'Acordar con cliente'
];

const state = {
  currentImage: '',
  currentFile: null,
  editingProductId: '',
  products: [],
  categories: [],
  orders: [],
  selectedOrderId: '',
  orderStatusFilter: 'Todo',
  orderSearch: ''
};

function activateAdminSection(sectionName) {
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.toggle('active', section.dataset.section === sectionName);
  });

  document.querySelectorAll('.admin-nav button').forEach(button => {
    button.classList.toggle('active', button.dataset.target === sectionName);
  });

  if (sectionName === 'pedidos') {
    refreshOrders(false);
  }
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function normalizeOrderId(order) {
  return order.id || order.orderNumber || order.order_number || '';
}

function getOrderNumber(order) {
  return order.orderNumber || order.order_number || 'Pedido';
}

function getOrderTotal(order) {
  return Number(order.totalEstimated ?? order.total_estimated ?? 0);
}

function getOrderCustomerName(order) {
  return order.customerName || order.customer_name || order.accountName || order.account_name || 'Cliente';
}

function getOrderCustomerEmail(order) {
  return order.customerEmail || order.customer_email || order.accountEmail || order.account_email || '';
}

function getOrderCustomerPhone(order) {
  return order.customerPhone || order.customer_phone || order.accountPhone || order.account_phone || '';
}

function getOrderItemCount(order) {
  return Number(order.itemCount ?? order.item_count ?? (Array.isArray(order.items) ? order.items.length : 0));
}

function getOrderDateNeeded(order) {
  const value = order.dateNeeded || order.date_needed || '';
  if (!value) return 'Por confirmar';
  return String(value).slice(0, 10);
}

function getOrderDateInputValue(order) {
  const value = order.dateNeeded || order.date_needed || '';
  return value ? String(value).slice(0, 10) : '';
}

function getOrderDeliveryType(order) {
  return order.deliveryType || order.delivery_type || 'Por confirmar';
}

function getOrderAdminNote(order) {
  return order.adminNote || order.admin_note || '';
}

function buildDeliveryOptions(currentValue) {
  const current = currentValue || 'Por confirmar';
  const options = DELIVERY_TYPES.includes(current) ? DELIVERY_TYPES : [current, ...DELIVERY_TYPES];
  return options.map(option => `<option value="${escapeHtml(option)}" ${option === current ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
}

function getOrderDetailsPayloadFromPanel() {
  return {
    deliveryType: document.getElementById('adminDeliveryType')?.value || 'Por confirmar',
    dateNeeded: document.getElementById('adminDateNeeded')?.value || '',
    adminNote: document.getElementById('adminNote')?.value || ''
  };
}

function getMissingStatusRequirements(status, payload = getOrderDetailsPayloadFromPanel()) {
  const nextStatus = status || document.getElementById('selectedOrderStatus')?.value || 'Pendiente de revisión';
  const deliveryType = String(payload.deliveryType || '').trim();
  const dateNeeded = String(payload.dateNeeded || '').trim();
  const adminNote = String(payload.adminNote || '').trim();

  if (nextStatus === 'Pendiente de revisión') return [];

  if (nextStatus === 'Cancelado') {
    return adminNote ? [] : ['nota del admin'];
  }

  const missing = [];
  if (!deliveryType || deliveryType === 'Por confirmar') missing.push('tipo de entrega');
  if (!dateNeeded) missing.push('fecha solicitada');
  if (!adminNote) missing.push('nota del admin');
  return missing;
}

function syncOrderStatusRequirementState() {
  const select = document.getElementById('selectedOrderStatus');
  const button = document.getElementById('saveOrderStatusBtn');
  const hint = document.getElementById('orderStatusRequirementHint');
  if (!select || !button || !hint) return;

  const missing = getMissingStatusRequirements(select.value);
  button.disabled = missing.length > 0;
  if (missing.length) {
    hint.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Para guardar este estado falta: ${escapeHtml(missing.join(', '))}.`;
    hint.classList.add('warning');
  } else {
    hint.innerHTML = '<i class="fa-solid fa-check"></i> Entrega, fecha y nota están listas para actualizar el estado.';
    hint.classList.remove('warning');
  }
}

function getSearchText(order) {
  return [
    getOrderNumber(order),
    getOrderCustomerName(order),
    getOrderCustomerEmail(order),
    getOrderCustomerPhone(order),
    order.status || '',
    order.deliveryType || order.delivery_type || ''
  ].join(' ').toLowerCase();
}

function getStatusCounts() {
  return state.orders.reduce((acc, order) => {
    const status = order.status || 'Pendiente de revisión';
    acc[status] = (acc[status] || 0) + 1;
    acc.Todo = (acc.Todo || 0) + 1;
    return acc;
  }, { Todo: 0 });
}

function normalizePhoneForWhatsApp(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function buildWhatsAppUrl(phone, orderNumber) {
  const digits = normalizePhoneForWhatsApp(phone);
  if (!digits) return '';
  const message = encodeURIComponent(`Hola, te contacto de Caja de Creaciones por tu pedido ${orderNumber}.`);
  return `https://wa.me/${digits}?text=${message}`;
}

async function copyTextToClipboard(value, successMessage) {
  const text = String(value || '').trim();
  if (!text) {
    alert('No hay dato para copiar.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    alert(successMessage || 'Dato copiado.');
  } catch (error) {
    window.prompt('Copia este dato:', text);
  }
}

function getFilteredOrders() {
  const search = String(state.orderSearch || '').trim().toLowerCase();

  return state.orders.filter(order => {
    const status = order.status || 'Pendiente de revisión';
    const matchesStatus = state.orderStatusFilter === 'Todo' || status === state.orderStatusFilter;
    const matchesSearch = !search || getSearchText(order).includes(search);
    return matchesStatus && matchesSearch;
  });
}

function renderAdminList() {
  const adminList = document.getElementById('adminList');
  const adminCounter = document.getElementById('adminCounter');
  if (!adminList) return;

  const published = state.products.filter(product => product.status === 'Publicado').length;
  if (adminCounter) adminCounter.textContent = `${published} publicados`;

  if (!state.products.length) {
    adminList.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        Todavía no hay productos cargados.
      </div>
    `;
    return;
  }

  adminList.innerHTML = state.products.map(product => `
    <div class="admin-item">
      <div class="admin-thumb"><img src="${escapeHtml(product.image || defaultImage)}" alt="${escapeHtml(product.name)}"></div>
      <div class="admin-info">
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.category)} · ${escapeHtml(product.material)} · ${escapeHtml(product.measures)}<br>${escapeHtml(product.detail)}</p>
        <div class="specs-row" style="margin: 0.45rem 0 0;">
          <span class="spec-chip">${escapeHtml(product.status)}</span>
          <span class="spec-chip">${escapeHtml(product.stock)}</span>
        </div>
      </div>
      <div class="admin-price">
        <strong>${money(product.price)}</strong>
        <div class="admin-tools">
          <button class="icon-btn" type="button" title="Editar producto" onclick="loadProductForEdit('${escapeHtml(product.id)}')"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="icon-btn danger" type="button" title="Archivar producto" onclick="deleteProduct('${escapeHtml(product.id)}')"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

async function refreshOrders(showLoading = true) {
  const orders = document.getElementById('ordersPreview');
  if (showLoading && orders) {
    orders.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        Cargando pedidos...
      </div>
    `;
  }

  try {
    state.orders = await loadOrders();
    renderOrdersPreview();

    if (state.selectedOrderId) {
      const stillExists = state.orders.some(order => normalizeOrderId(order) === state.selectedOrderId);
      if (stillExists) {
        await openOrderDetail(state.selectedOrderId, false);
      } else {
        state.selectedOrderId = '';
        renderEmptyOrderDetail();
      }
    } else {
      const firstVisibleOrder = getFilteredOrders()[0];
      if (firstVisibleOrder) {
        await openOrderDetail(normalizeOrderId(firstVisibleOrder), false);
      } else {
        renderEmptyOrderDetail();
      }
    }
  } catch (error) {
    if (orders) {
      orders.innerHTML = `
        <div class="empty-state danger-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          ${escapeHtml(error.message || 'No se pudieron cargar los pedidos.')}
        </div>
      `;
    }
  }
}

function renderOrdersPreview() {
  const orders = document.getElementById('ordersPreview');
  const counter = document.getElementById('ordersCounter');
  if (!orders) return;

  renderOrdersStatusSummary();

  if (counter) {
    counter.textContent = `${state.orders.length} pedido${state.orders.length === 1 ? '' : 's'}`;
  }

  const filteredOrders = getFilteredOrders();
  if (!filteredOrders.length) {
    const hasSearch = Boolean(String(state.orderSearch || '').trim());
    orders.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-clipboard"></i>
        ${state.orders.length ? (hasSearch ? 'No hay pedidos que coincidan con la búsqueda.' : 'No hay pedidos con este estado.') : 'Todavía no hay pedidos reales. Cuando el cliente confirme uno, aparecerá aquí.'}
      </div>
    `;
    return;
  }

  orders.innerHTML = filteredOrders.map(order => {
    const orderId = normalizeOrderId(order);
    const status = order.status || 'Pendiente de revisión';
    const itemCount = getOrderItemCount(order);
    const selectedClass = orderId === state.selectedOrderId ? 'active' : '';
    const phone = getOrderCustomerPhone(order);
    const email = getOrderCustomerEmail(order);

    return `
      <button class="order-admin-card ${selectedClass}" type="button" data-order-id="${escapeHtml(orderId)}">
        <span class="order-card-topline">
          <strong>${escapeHtml(getOrderNumber(order))}</strong>
          <em class="status-pill status-${escapeHtml(slugify(status))}">${escapeHtml(status)}</em>
        </span>
        <span class="order-card-customer">${escapeHtml(getOrderCustomerName(order))}</span>
        <span class="order-card-contact">
          ${email ? `<span><i class="fa-regular fa-envelope"></i> ${escapeHtml(email)}</span>` : ''}
          ${phone ? `<span><i class="fa-solid fa-phone"></i> ${escapeHtml(phone)}</span>` : ''}
        </span>
        <span class="order-card-meta">
          <span><i class="fa-regular fa-clock"></i> ${escapeHtml(formatDateTime(order.createdAt || order.created_at))}</span>
          <span><i class="fa-solid fa-box"></i> ${itemCount} pieza${itemCount === 1 ? '' : 's'}</span>
          <span><i class="fa-solid fa-coins"></i> ${money(getOrderTotal(order))}</span>
        </span>
      </button>
    `;
  }).join('');
}

function renderOrdersStatusSummary() {
  const container = document.getElementById('ordersStatusSummary');
  if (!container) return;

  const counts = getStatusCounts();
  const statuses = ['Todo', ...ORDER_STATUSES];

  container.innerHTML = statuses.map(status => {
    const activeClass = state.orderStatusFilter === status ? 'active' : '';
    const count = counts[status] || 0;
    return `
      <button class="order-status-chip ${activeClass}" type="button" data-status-filter="${escapeHtml(status)}">
        <span>${escapeHtml(status)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join('');
}

function renderEmptyOrderDetail() {
  const panel = document.getElementById('orderDetailPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="empty-state">
      <i class="fa-regular fa-hand-pointer"></i>
      Selecciona un pedido para ver productos, cliente y control de estado.
    </div>
  `;
}

function getItemProduct(item) {
  return item.productSnapshot || item.product_snapshot || {};
}


function parseObjectSafe(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getOrderAiPayload(order = {}) {
  return parseObjectSafe(order.aiPayload || order.ai_payload, null);
}

function getCustomReferenceImages(order = {}) {
  const payload = getOrderAiPayload(order);
  const payloadReferences = Array.isArray(payload?.referenceImages) ? payload.referenceImages : [];
  const itemReferences = Array.isArray(order.items)
    ? order.items.flatMap(item => {
        const itemPayload = parseObjectSafe(item.aiPayload || item.ai_payload, null);
        const product = getItemProduct(item);
        return [
          ...(Array.isArray(itemPayload?.referenceImages) ? itemPayload.referenceImages : []),
          ...(Array.isArray(product.referenceImages) ? product.referenceImages : [])
        ];
      })
    : [];

  const unique = new Map();
  [...payloadReferences, ...itemReferences].forEach(reference => {
    const url = typeof reference === 'string' ? reference : reference?.url;
    if (!url || unique.has(url)) return;
    unique.set(url, {
      url,
      name: typeof reference === 'string' ? 'Referencia' : (reference.name || 'Referencia')
    });
  });

  return Array.from(unique.values());
}

function renderCustomOrderAiBlock(order = {}) {
  const payload = getOrderAiPayload(order);
  const summary = payload?.summary || null;
  const aiSummary = order.aiSummary || order.ai_summary || '';
  const references = getCustomReferenceImages(order);

  if (!summary && !aiSummary && !references.length) return '';

  const rows = summary ? [
    ['Qué quiere', summary.what],
    ['Cómo lo quiere', summary.how],
    ['Cantidad/piezas', summary.pieces],
    ['Fecha necesaria', summary.dateNeeded],
    ['Modelo base', summary.baseProduct],
    ['Modificaciones', summary.modifications],
    ['Entrega', summary.deliveryType]
  ].filter(([, value]) => String(value || '').trim()) : [];

  return `
    <div class="order-detail-block custom-ai-summary-block">
      <h4><i class="fa-solid fa-wand-magic-sparkles"></i> Resumen IA del personalizado</h4>
      ${aiSummary ? `<p>${escapeHtml(aiSummary)}</p>` : ''}
      ${rows.length ? `
        <div class="summary-grid">
          ${rows.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${references.length ? `
        <div class="custom-reference-block">
          <h4><i class="fa-regular fa-image"></i> Referencias del cliente</h4>
          <div class="custom-reference-grid">
            ${references.map((reference, index) => `
              <a href="${escapeHtml(reference.url)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(reference.url)}" alt="Referencia ${index + 1}">
                <span>${escapeHtml(reference.name || `Referencia ${index + 1}`)}</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderOrderItems(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return `
      <div class="empty-state compact-empty">
        <i class="fa-regular fa-box-open"></i>
        Este pedido no tiene partidas visibles.
      </div>
    `;
  }

  return items.map(item => {
    const product = getItemProduct(item);
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPriceEstimated ?? item.unit_price_estimated ?? product.price ?? 0);
    const lineTotal = Number(item.lineTotalEstimated ?? item.line_total_estimated ?? (unitPrice * quantity));
    const notes = item.customizationNotes || item.customization_notes || '';
    const itemStatus = item.status || 'Pendiente';

    return `
      <div class="admin-order-item order-item-expanded">
        <img src="${escapeHtml(product.image || defaultImage)}" alt="${escapeHtml(product.name || 'Producto')}">
        <div class="admin-order-item-body">
          <div class="admin-order-item-title">
            <strong>${escapeHtml(product.name || 'Producto artesanal')}</strong>
            <em class="status-pill">${escapeHtml(itemStatus)}</em>
          </div>
          <span>${quantity} × ${money(unitPrice)} · ${money(lineTotal)}</span>
          <div class="order-item-specs">
            ${product.category ? `<small><i class="fa-solid fa-tag"></i> ${escapeHtml(product.category)}</small>` : ''}
            ${product.measures ? `<small><i class="fa-solid fa-ruler-combined"></i> ${escapeHtml(product.measures)}</small>` : ''}
            ${product.material ? `<small><i class="fa-solid fa-layer-group"></i> ${escapeHtml(product.material)}</small>` : ''}
            ${product.time ? `<small><i class="fa-regular fa-clock"></i> ${escapeHtml(product.time)}</small>` : ''}
          </div>
          ${notes ? `<small class="order-item-notes"><i class="fa-regular fa-note-sticky"></i> ${escapeHtml(notes)}</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderOrderDetail(order) {
  const panel = document.getElementById('orderDetailPanel');
  if (!panel || !order) return;

  const status = order.status || 'Pendiente de revisión';
  const notes = order.notes || 'Sin notas adicionales.';
  const adminNote = getOrderAdminNote(order);
  const deliveryType = getOrderDeliveryType(order);
  const dateNeededInput = getOrderDateInputValue(order);
  const email = getOrderCustomerEmail(order);
  const phone = getOrderCustomerPhone(order);
  const orderNumber = getOrderNumber(order);
  const itemCount = Array.isArray(order.items) ? order.items.length : getOrderItemCount(order);
  const subtotal = Number(order.subtotalEstimated ?? order.subtotal_estimated ?? getOrderTotal(order));
  const total = getOrderTotal(order);
  const whatsAppUrl = buildWhatsAppUrl(phone, orderNumber);
  const contactText = [
    getOrderCustomerName(order),
    email ? `Correo: ${email}` : '',
    phone ? `Teléfono: ${phone}` : '',
    `Pedido: ${orderNumber}`
  ].filter(Boolean).join('\n');

  panel.innerHTML = `
    <div class="order-detail-head order-detail-head-expanded">
      <div>
        <span>Expediente del pedido</span>
        <h3>${escapeHtml(orderNumber)}</h3>
        <small>Actualizado ${escapeHtml(formatDateTime(order.updatedAt || order.updated_at || order.createdAt || order.created_at))}</small>
      </div>
      <em class="status-pill status-${escapeHtml(slugify(status))}">${escapeHtml(status)}</em>
    </div>

    <div class="order-total-strip">
      <div>
        <span>Piezas</span>
        <strong>${itemCount}</strong>
      </div>
      <div>
        <span>Subtotal</span>
        <strong>${money(subtotal)}</strong>
      </div>
      <div>
        <span>Total estimado</span>
        <strong>${money(total)}</strong>
      </div>
    </div>

    <div class="order-detail-block">
      <div class="order-block-title">
        <h4><i class="fa-regular fa-user"></i> Cliente</h4>
        <button class="btn-mini" type="button" data-copy-contact="${escapeHtml(contactText)}">
          <i class="fa-regular fa-copy"></i> Copiar
        </button>
      </div>
      <div class="customer-detail-card">
        <strong>${escapeHtml(getOrderCustomerName(order))}</strong>
        <span>${escapeHtml(email || 'Correo no registrado')}</span>
        <span>${escapeHtml(phone || 'Teléfono no registrado')}</span>
        <div class="customer-contact-actions">
          ${email ? `<a class="btn-mini" href="mailto:${escapeHtml(email)}"><i class="fa-regular fa-envelope"></i> Correo</a>` : ''}
          ${whatsAppUrl ? `<a class="btn-mini" href="${escapeHtml(whatsAppUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
        </div>
      </div>
    </div>

    <div class="order-detail-grid">
      <div>
        <span>Entrega</span>
        <strong>${escapeHtml(deliveryType)}</strong>
      </div>
      <div>
        <span>Fecha solicitada</span>
        <strong>${escapeHtml(dateNeededInput || 'Por confirmar')}</strong>
      </div>
      <div>
        <span>Creado</span>
        <strong>${escapeHtml(formatDateTime(order.createdAt || order.created_at))}</strong>
      </div>
      <div>
        <span>Cuenta</span>
        <strong>${escapeHtml(order.customerUserId || order.customer_user_id ? 'Cliente registrado' : 'Sin cuenta ligada')}</strong>
      </div>
    </div>

    <div class="order-detail-block">
      <h4><i class="fa-regular fa-note-sticky"></i> Notas del cliente</h4>
      <p>${escapeHtml(notes)}</p>
    </div>

    ${renderCustomOrderAiBlock(order)}

    <div class="order-detail-block admin-response-block">
      <div class="order-block-title">
        <h4><i class="fa-solid fa-reply"></i> Respuesta del admin para el cliente</h4>
        <button class="btn-mini" type="button" id="saveOrderDetailsBtn" data-order-id="${escapeHtml(normalizeOrderId(order))}">
          <i class="fa-solid fa-floppy-disk"></i> Guardar nota y entrega
        </button>
      </div>
      <p class="order-status-hint">Antes de confirmar o avanzar el pedido, define entrega, fecha y una nota visible para el comprador.</p>
      <div class="admin-order-fields-grid">
        <div class="form-field">
          <label for="adminDeliveryType">Tipo de entrega</label>
          <select class="select" id="adminDeliveryType">
            ${buildDeliveryOptions(deliveryType)}
          </select>
        </div>
        <div class="form-field">
          <label for="adminDateNeeded">Fecha solicitada / acordada</label>
          <input class="input" id="adminDateNeeded" type="date" value="${escapeHtml(dateNeededInput)}">
        </div>
      </div>
      <div class="form-field admin-note-field">
        <label for="adminNote">Nota visible para el cliente</label>
        <textarea class="textarea" id="adminNote" placeholder="Ejemplo: Tu pedido fue confirmado. Tiempo estimado: 3 a 5 días.">${escapeHtml(adminNote)}</textarea>
      </div>
    </div>

    <div class="order-detail-block">
      <div class="order-block-title">
        <h4><i class="fa-solid fa-boxes-stacked"></i> Productos</h4>
        <span class="mini-badge">${itemCount} pieza${itemCount === 1 ? '' : 's'}</span>
      </div>
      <div class="admin-order-items">
        ${renderOrderItems(order.items)}
      </div>
    </div>

    <div class="order-status-control">
      <label for="selectedOrderStatus">Cambiar estado</label>
      <p class="order-status-hint" id="orderStatusRequirementHint">El estado visible para el comprador cambia cuando guardas esta selección.</p>
      <div class="order-status-actions">
        <select class="select" id="selectedOrderStatus">
          ${ORDER_STATUSES.map(option => `<option value="${escapeHtml(option)}" ${option === status ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>
        <button class="btn-primary" type="button" id="saveOrderStatusBtn" data-order-id="${escapeHtml(normalizeOrderId(order))}">
          <i class="fa-solid fa-floppy-disk"></i> Guardar estado
        </button>
      </div>
    </div>
  `;
  syncOrderStatusRequirementState();
}

async function openOrderDetail(orderId, showLoading = true) {
  if (!orderId) return;

  const panel = document.getElementById('orderDetailPanel');
  state.selectedOrderId = orderId;
  renderOrdersPreview();

  if (showLoading && panel) {
    panel.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        Cargando detalle del pedido...
      </div>
    `;
  }

  try {
    const order = await loadOrderDetail(orderId);
    renderOrderDetail(order);
  } catch (error) {
    if (panel) {
      panel.innerHTML = `
        <div class="empty-state danger-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          ${escapeHtml(error.message || 'No se pudo abrir el pedido.')}
        </div>
      `;
    }
  }
}

async function saveOrderAdminDetails(orderId, options = {}) {
  if (!orderId) return null;

  const payload = getOrderDetailsPayloadFromPanel();
  const button = document.getElementById('saveOrderDetailsBtn');
  const originalText = button ? button.innerHTML : '';

  if (button && !options.silent) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const order = await updateOrderDetailsRequest(orderId, payload);
    await refreshOrders(false);
    if (order) renderOrderDetail(order);
    if (!options.silent) alert('Nota, fecha y entrega actualizadas.');
    return order;
  } catch (error) {
    if (!options.silent) alert(error.message || 'No se pudo guardar la nota y entrega del pedido.');
    throw error;
  } finally {
    if (button && !options.silent) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

async function saveSelectedOrderStatus(orderId) {
  const select = document.getElementById('selectedOrderStatus');
  const button = document.getElementById('saveOrderStatusBtn');
  if (!select || !orderId) return;

  const originalText = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const missing = getMissingStatusRequirements(select.value);
    if (missing.length) {
      alert(`Antes de cambiar el estado completa: ${missing.join(', ')}.`);
      syncOrderStatusRequirementState();
      return;
    }

    await saveOrderAdminDetails(orderId, { silent: true });
    const order = await updateOrderStatusRequest(orderId, select.value);
    await refreshOrders(false);
    if (order) renderOrderDetail(order);
  } catch (error) {
    alert(error.message || 'No se pudo actualizar el estado del pedido.');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

function renderCategorySelect() {
  const select = document.getElementById('categoryInput');
  if (!select) return;

  const currentValue = select.value || 'Resina';
  const categories = state.categories.length
    ? state.categories
    : getCategories(state.products)
      .filter(category => category !== 'Todo')
      .map(name => ({ name, productCount: 0 }));

  select.innerHTML = categories.map(category => `
    <option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>
  `).join('');

  if (categories.some(category => category.name === currentValue)) {
    select.value = currentValue;
  } else if (categories.length) {
    select.value = categories[0].name;
  }
}

function renderCategoriesPreview() {
  const container = document.getElementById('categoriesPreview');
  if (!container) return;

  const categories = state.categories.length
    ? state.categories
    : getCategories(state.products)
      .filter(category => category !== 'Todo')
      .map(name => ({
        name,
        productCount: state.products.filter(product => product.category === name && product.status === 'Publicado').length
      }));

  if (!categories.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        Todavía no hay categorías activas.
      </div>
    `;
    return;
  }

  container.innerHTML = categories.map(category => {
    const count = Number(category.productCount ?? category.product_count ?? 0);
    return `
      <div class="preview-row">
        <span>Categoría</span>
        <strong>${escapeHtml(category.name)}</strong>
        <span>${count} producto${count === 1 ? '' : 's'}</span>
      </div>
    `;
  }).join('');
}

function getProductFormData() {
  const specs = document.getElementById('specsInput').value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const formData = new FormData();
  formData.append('name', document.getElementById('nameInput').value);
  formData.append('category', document.getElementById('categoryInput').value);
  formData.append('price', document.getElementById('priceInput').value || '0');
  formData.append('measures', document.getElementById('measureInput').value);
  formData.append('material', document.getElementById('materialInput').value);
  formData.append('time', document.getElementById('timeInput').value);
  formData.append('stock', document.getElementById('stockInput').value);
  formData.append('status', document.getElementById('statusInput').value);
  formData.append('personalizable', document.getElementById('customInput').value);
  formData.append('specs', JSON.stringify(specs.length ? specs : ['Personalizable']));
  formData.append('detail', document.getElementById('detailInput').value);
  formData.append('currentImage', state.currentImage || defaultImage);

  if (state.currentFile) {
    formData.append('imageFile', state.currentFile);
  }

  return formData;
}

async function addProduct() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) {
    alert('El producto necesita nombre antes de guardarse.');
    return;
  }

  const button = document.getElementById('addProductBtn');
  const originalText = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    if (state.editingProductId) {
      await updateProductRequest(state.editingProductId, getProductFormData());
    } else {
      await createProductRequest(getProductFormData());
    }

    state.products = await loadProducts({ includeHidden: true });
    state.categories = await loadCategories();
    await renderAllAdmin();
    clearForm(true);
  } catch (error) {
    alert(error.message || 'No se pudo guardar el producto.');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }
}

async function deleteProduct(id) {
  const accepted = confirm('El producto se archivará y dejará de aparecer en el catálogo.');
  if (!accepted) return;

  try {
    await deleteProductRequest(id);
    state.products = await loadProducts({ includeHidden: true });
    state.categories = await loadCategories();
    await renderAllAdmin();
  } catch (error) {
    alert(error.message || 'No se pudo archivar el producto.');
  }
}

function loadProductForEdit(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;

  state.editingProductId = product.id;
  state.currentImage = product.image;
  state.currentFile = null;

  document.getElementById('nameInput').value = product.name;
  document.getElementById('categoryInput').value = product.category;
  document.getElementById('priceInput').value = product.price;
  document.getElementById('measureInput').value = product.measures;
  document.getElementById('materialInput').value = product.material;
  document.getElementById('timeInput').value = product.time;
  document.getElementById('stockInput').value = product.stock;
  document.getElementById('statusInput').value = product.status;
  document.getElementById('customInput').value = product.personalizable;
  document.getElementById('specsInput').value = product.specs.join(', ');
  document.getElementById('detailInput').value = product.detail;

  document.getElementById('imagePreview').src = product.image;
  document.getElementById('uploadZone').classList.add('has-image');

  const button = document.getElementById('addProductBtn');
  if (button) button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Actualizar producto';

  activateAdminSection('productos');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearForm(clearValues = true) {
  state.currentImage = '';
  state.currentFile = null;
  state.editingProductId = '';
  document.getElementById('imageInput').value = '';
  document.getElementById('imagePreview').removeAttribute('src');
  document.getElementById('uploadZone').classList.remove('has-image');

  const button = document.getElementById('addProductBtn');
  if (button) button.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar producto';

  if (!clearValues) return;

  document.getElementById('nameInput').value = '';
  document.getElementById('categoryInput').value = state.categories[0]?.name || 'Resina';
  document.getElementById('priceInput').value = '';
  document.getElementById('measureInput').value = '';
  document.getElementById('materialInput').value = '';
  document.getElementById('timeInput').value = '';
  document.getElementById('stockInput').value = 'Bajo pedido';
  document.getElementById('statusInput').value = 'Publicado';
  document.getElementById('customInput').value = 'Sí';
  document.getElementById('specsInput').value = '';
  document.getElementById('detailInput').value = '';
}

async function renderAllAdmin() {
  renderCategorySelect();
  renderAdminList();
  renderOrdersPreview();
  renderCategoriesPreview();
}

async function initAdmin() {
  state.products = await loadProducts({ includeHidden: true });
  state.categories = await loadCategories();
  await refreshOrders(false);
  await renderAllAdmin();
}

function bindAdminEvents() {
  document.querySelectorAll('.admin-nav button').forEach(button => {
    button.addEventListener('click', () => activateAdminSection(button.dataset.target));
  });

  document.getElementById('imageInput')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;

    state.currentFile = file;

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
      state.currentImage = loadEvent.target.result;
      document.getElementById('imagePreview').src = state.currentImage;
      document.getElementById('uploadZone').classList.add('has-image');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('addProductBtn')?.addEventListener('click', addProduct);
  document.getElementById('resetFormBtn')?.addEventListener('click', () => clearForm(true));
  document.getElementById('resetCatalogBtn')?.addEventListener('click', async () => {
    const accepted = confirm('Esto restaurará los productos demo. En modo MySQL también limpia pedidos preview.');
    if (!accepted) return;

    try {
      state.products = await resetDemoRequest();
      state.categories = await loadCategories();
      clearForm(true);
      await refreshOrders(false);
      await renderAllAdmin();
    } catch (error) {
      alert(error.message || 'No se pudo restaurar el demo.');
    }
  });

  document.getElementById('ordersPreview')?.addEventListener('click', event => {
    const button = event.target.closest('[data-order-id]');
    if (!button) return;
    openOrderDetail(button.dataset.orderId);
  });

  document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => refreshOrders(true));

  document.getElementById('orderStatusFilter')?.addEventListener('change', event => {
    state.orderStatusFilter = event.target.value;
    renderOrdersPreview();
  });

  document.getElementById('orderSearchInput')?.addEventListener('input', event => {
    state.orderSearch = event.target.value;
    renderOrdersPreview();
  });

  document.getElementById('ordersStatusSummary')?.addEventListener('click', event => {
    const button = event.target.closest('[data-status-filter]');
    if (!button) return;
    state.orderStatusFilter = button.dataset.statusFilter || 'Todo';
    const select = document.getElementById('orderStatusFilter');
    if (select) select.value = state.orderStatusFilter;
    renderOrdersPreview();
  });

  document.getElementById('orderDetailPanel')?.addEventListener('click', event => {
    const saveDetailsButton = event.target.closest('#saveOrderDetailsBtn');
    if (saveDetailsButton) {
      saveOrderAdminDetails(saveDetailsButton.dataset.orderId);
      return;
    }

    const saveButton = event.target.closest('#saveOrderStatusBtn');
    if (saveButton) {
      saveSelectedOrderStatus(saveButton.dataset.orderId);
      return;
    }

    const copyButton = event.target.closest('[data-copy-contact]');
    if (copyButton) {
      copyTextToClipboard(copyButton.dataset.copyContact, 'Contacto copiado.');
    }
  });

  document.getElementById('orderDetailPanel')?.addEventListener('input', event => {
    if (event.target.closest('#adminNote, #adminDateNeeded')) {
      syncOrderStatusRequirementState();
    }
  });

  document.getElementById('orderDetailPanel')?.addEventListener('change', event => {
    if (event.target.closest('#adminDeliveryType, #selectedOrderStatus, #adminDateNeeded')) {
      syncOrderStatusRequirementState();
    }
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', cerrarSesionAdmin);
}

async function cerrarSesionAdmin() {
  try {
    await fetch('/api/auth/admin/logout', { method: 'POST' });
  } finally {
    window.location.href = '/admin/login';
  }
}

bindAdminEvents();
initAdmin();
