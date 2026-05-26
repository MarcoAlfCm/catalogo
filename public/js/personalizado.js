const customOrderState = {
  user: null,
  products: [],
  selectedProductId: '',
  referenceImages: [],
  messages: [],
  lastResult: null,
  busy: false
};

function getBaseProductFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('base') || params.get('product') || '';
}

function pushChatMessage(role, content) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) return;

  const lastMessage = customOrderState.messages[customOrderState.messages.length - 1];
  if (role === 'assistant' && lastMessage?.role === 'assistant' && lastMessage.content === cleanContent) {
    return;
  }

  customOrderState.messages.push({ role, content: cleanContent });
  renderCustomChat();
}

function renderCustomChat() {
  const chat = document.getElementById('customChat');
  if (!chat) return;

  if (!customOrderState.messages.length) {
    chat.innerHTML = `
      <div class="custom-chat-empty">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <strong>Empieza con tu idea.</strong>
        <span>Cuéntame qué quieres hacer. A la derecha se irá armando la solicitud y te marcará lo que todavía falte.</span>
      </div>
    `;
    return;
  }

  chat.innerHTML = customOrderState.messages.map(message => `
    <div class="chat-bubble ${message.role === 'assistant' ? 'assistant' : 'user'}">
      <small>${message.role === 'assistant' ? 'Asistente IA' : 'Cliente'}</small>
      <p>${escapeHtml(message.content)}</p>
    </div>
  `).join('');

  chat.scrollTop = chat.scrollHeight;
}

function renderReferences() {
  const strip = document.getElementById('referenceStrip');
  if (!strip) return;

  if (!customOrderState.referenceImages.length) {
    strip.innerHTML = `
      <div class="reference-empty">
        <i class="fa-regular fa-image"></i>
        Sin referencias subidas todavía.
      </div>
    `;
    return;
  }

  strip.innerHTML = customOrderState.referenceImages.map((reference, index) => `
    <div class="reference-thumb">
      <img src="${escapeHtml(reference.url)}" alt="Referencia ${index + 1}">
      <span>${escapeHtml(reference.name || `Referencia ${index + 1}`)}</span>
      <button type="button" data-remove-reference="${index}" aria-label="Quitar referencia"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');
}

function renderBaseProducts() {
  const select = document.getElementById('baseProductSelect');
  if (!select) return;

  const requestedBase = getBaseProductFromUrl();
  select.innerHTML = `
    <option value="">Sin modelo base, quiero una pieza nueva</option>
    ${customOrderState.products.map(product => `
      <option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${escapeHtml(product.category)}</option>
    `).join('')}
  `;

  if (requestedBase) {
    const found = customOrderState.products.find(product => product.id === requestedBase || product.slug === requestedBase);
    if (found) {
      select.value = found.id;
      customOrderState.selectedProductId = found.id;
    }
  }
}

function getSummaryRows(summary = {}) {
  return [
    ['Qué quiere', summary.what],
    ['Cómo lo quiere', summary.how],
    ['Cantidad/piezas', summary.pieces],
    ['Fecha necesaria', summary.dateNeeded],
    ['Modelo base', summary.baseProduct],
    ['Modificaciones', summary.modifications],
    ['Entrega', summary.deliveryType],
    ['Referencias', summary.referenceImagesCount ? `${summary.referenceImagesCount} imagen(es)` : 'Sin referencias']
  ].filter(([, value]) => String(value || '').trim());
}

function renderSummary() {
  const card = document.getElementById('customSummaryCard');
  const content = document.getElementById('customSummaryContent');
  const finishButton = document.getElementById('finishCustomOrderBtn');
  const result = customOrderState.lastResult;

  if (!card || !content || !finishButton) return;

  if (!result || !result.summary) {
    finishButton.disabled = true;
    content.innerHTML = `
      <div class="summary-empty">
        <strong>Tu borrador todavía está limpio.</strong>
        <p>Escribe una frase con la pieza, cantidad, detalles y fecha. Si subes foto, aclara qué debe tomarse de ella.</p>
      </div>
      <div class="summary-guide-list">
        <div><span>Pieza</span><strong>Qué quieres crear o modificar.</strong></div>
        <div><span>Cantidad</span><strong>Cuántas piezas, sets o recuerdos necesitas.</strong></div>
        <div><span>Detalles</span><strong>Colores, medidas, texto, tema o cambios.</strong></div>
        <div><span>Fecha</span><strong>Para cuándo lo necesitas o si solo cotizas.</strong></div>
        <div><span>Referencia</span><strong>Qué parte de la foto importa: forma, color, textura o idea.</strong></div>
      </div>
    `;
    return;
  }

  const summary = result.summary;
  const rows = getSummaryRows(summary);
  const missingPrompts = Array.isArray(result.missingPrompts) ? result.missingPrompts : [];
  card.hidden = false;
  finishButton.disabled = !result.isComplete;

  content.innerHTML = `
    ${summary.customerFriendlySummary ? `<p class="summary-main">${escapeHtml(summary.customerFriendlySummary)}</p>` : ''}
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
    ${missingPrompts.length ? `
      <div class="summary-missing summary-missing-detailed">
        <i class="fa-solid fa-circle-exclamation"></i>
        <div>
          <strong>Falta para cerrar:</strong>
          ${missingPrompts.map(item => `
            <p><b>${escapeHtml(item.field)}:</b> ${escapeHtml(item.prompt)} <em>${escapeHtml(item.example)}</em></p>
          `).join('')}
        </div>
      </div>
    ` : Array.isArray(result.missingFields) && result.missingFields.length ? `
      <div class="summary-missing">
        <i class="fa-solid fa-circle-exclamation"></i>
        Falta precisar: ${escapeHtml(result.missingFields.join(', '))}
      </div>
    ` : `
      <div class="summary-ready">
        <i class="fa-solid fa-check"></i>
        La solicitud ya puede enviarse al admin.
      </div>
    `}
  `;
}
function setBusy(isBusy, label = 'Trabajando...') {
  customOrderState.busy = isBusy;
  const sendButton = document.getElementById('sendCustomMessageBtn');
  const finishButton = document.getElementById('finishCustomOrderBtn');
  const referenceDropZone = document.getElementById('referenceDropZone');

  if (sendButton) {
    sendButton.disabled = isBusy;
    sendButton.innerHTML = isBusy
      ? `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(label)}`
      : '<i class="fa-solid fa-paper-plane"></i> Continuar solicitud';
  }

  if (finishButton) {
    finishButton.disabled = isBusy || !(customOrderState.lastResult && customOrderState.lastResult.isComplete);
  }

  referenceDropZone?.classList.toggle('is-uploading', isBusy && String(label || '').toLowerCase().includes('referencia'));
}

function resetReferenceDropZone() {
  const input = document.getElementById('referenceImage');
  const preview = document.getElementById('referencePreview');
  const zone = document.getElementById('referenceDropZone');

  if (input) input.value = '';
  if (preview) preview.removeAttribute('src');
  zone?.classList.remove('has-image', 'is-dragging', 'is-uploading');
}

function previewReferenceFile(file) {
  const preview = document.getElementById('referencePreview');
  const zone = document.getElementById('referenceDropZone');
  if (!file || !preview || !zone) return;

  const reader = new FileReader();
  reader.onload = function(loadEvent) {
    preview.src = loadEvent.target.result;
    zone.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function validateReferenceFile(file) {
  if (!file) return 'Selecciona una imagen de referencia.';

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowedTypes.includes(file.type)) {
    return 'La referencia debe ser una imagen JPG, PNG, WEBP, GIF o AVIF.';
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    return 'La imagen no debe superar 5MB.';
  }

  return '';
}

async function uploadSelectedReference(file) {
  if (customOrderState.busy) return;

  const validationError = validateReferenceFile(file);
  if (validationError) {
    alert(validationError);
    resetReferenceDropZone();
    return;
  }

  previewReferenceFile(file);

  const formData = new FormData();
  formData.append('referenceImage', file);
  setBusy(true, 'Subiendo referencia...');

  try {
    const reference = await uploadCustomReferenceRequest(formData);
    if (reference) {
      customOrderState.referenceImages.push(reference);
      renderReferences();
      pushChatMessage('assistant', 'La referencia ya quedó guardada para que el admin la vea. Dime qué parte importa de esa imagen: forma, color, pose, textura, personaje o solo inspiración.');
      await refreshCustomOrderAnalysis({ force: true });
    }
  } catch (error) {
    alert(error.message || 'No se pudo subir la referencia.');
  } finally {
    resetReferenceDropZone();
    setBusy(false);
  }
}

async function sendCustomMessage(event) {
  event.preventDefault();
  if (customOrderState.busy) return;

  const input = document.getElementById('customMessage');
  const message = String(input?.value || '').trim();
  if (!message) {
    alert('Escribe la idea del pedido personalizado antes de enviarla a la IA.');
    return;
  }

  pushChatMessage('user', message);
  if (input) input.value = '';
  setBusy(true, 'Ordenando idea...');

  try {
    const result = await chatCustomOrderRequest({
      selectedProductId: customOrderState.selectedProductId,
      referenceImages: customOrderState.referenceImages,
      messages: customOrderState.messages
    });

    customOrderState.lastResult = result;
    pushChatMessage('assistant', result?.reply || 'Ya actualicé la solicitud. Dime el siguiente detalle que falte.');
    renderSummary();
  } catch (error) {
    alert(error.message || 'No se pudo consultar la IA.');
  } finally {
    setBusy(false);
  }
}

async function refreshCustomOrderAnalysis({ addAssistantMessage = false, force = false } = {}) {
  if (customOrderState.busy && !force) return;
  if (!customOrderState.messages.some(message => message.role === 'user')) {
    renderSummary();
    return;
  }

  setBusy(true, 'Actualizando resumen...');

  try {
    const result = await chatCustomOrderRequest({
      selectedProductId: customOrderState.selectedProductId,
      referenceImages: customOrderState.referenceImages,
      messages: customOrderState.messages
    });

    customOrderState.lastResult = result;
    if (addAssistantMessage) {
      pushChatMessage('assistant', result?.reply || 'Referencia actualizada. Dime qué parte de esa imagen debe tomarse en cuenta.');
    }
    renderSummary();
  } catch (error) {
    console.warn(error.message || 'No se pudo refrescar el resumen personalizado.');
  } finally {
    setBusy(false);
  }
}

async function uploadReference(event) {
  event.preventDefault();
  const input = document.getElementById('referenceImage');
  const file = input?.files?.[0];
  await uploadSelectedReference(file);
}

async function finishCustomOrder() {
  if (customOrderState.busy) return;
  if (!customOrderState.lastResult || !customOrderState.lastResult.isComplete) {
    alert('Todavía falta cerrar información clave antes de crear la solicitud.');
    return;
  }

  setBusy(true, 'Creando solicitud...');

  try {
    const order = await finalizeCustomOrderRequest({
      selectedProductId: customOrderState.selectedProductId,
      referenceImages: customOrderState.referenceImages,
      messages: customOrderState.messages,
      summary: customOrderState.lastResult.summary
    });

    alert(`Solicitud creada: ${order.orderNumber || 'pedido personalizado'}\nEstado: Pendiente de revisión.`);
    window.location.href = order.id ? `/cuenta/pedido/${encodeURIComponent(order.id)}` : '/cuenta';
  } catch (error) {
    alert(error.message || 'No se pudo crear la solicitud personalizada.');
  } finally {
    setBusy(false);
  }
}

async function initPersonalizado() {
  const user = await renderCustomerMenu({ active: 'personalizado', loginNext: '/personalizado' });
  if (!user) {
    window.location.href = getCustomerLoginUrl('/personalizado');
    return;
  }

  customOrderState.user = user;
  const text = document.getElementById('customSessionText');
  if (text) {
    text.textContent = `${user.name || 'Cliente'} · solicitud protegida`;
  }

  customOrderState.products = await loadProducts({ includeHidden: false });
  renderBaseProducts();
  renderReferences();
  renderCustomChat();
  renderSummary();

  if (customOrderState.selectedProductId) {
    const product = customOrderState.products.find(item => item.id === customOrderState.selectedProductId);
    if (product) {
      pushChatMessage('assistant', `Tomaré como base “${product.name}”. Cuéntame qué cambio necesitas: color, tamaño, texto, cantidad, fecha o algún detalle especial.`);
    }
  }
}

document.getElementById('customChatForm')?.addEventListener('submit', sendCustomMessage);
document.getElementById('referenceForm')?.addEventListener('submit', uploadReference);
document.getElementById('referenceImage')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) uploadSelectedReference(file);
});

const referenceDropZone = document.getElementById('referenceDropZone');
if (referenceDropZone) {
  ['dragenter', 'dragover'].forEach(type => {
    referenceDropZone.addEventListener(type, event => {
      event.preventDefault();
      referenceDropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach(type => {
    referenceDropZone.addEventListener(type, event => {
      event.preventDefault();
      referenceDropZone.classList.remove('is-dragging');
    });
  });

  referenceDropZone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) uploadSelectedReference(file);
  });
}

document.getElementById('finishCustomOrderBtn')?.addEventListener('click', finishCustomOrder);
document.getElementById('baseProductSelect')?.addEventListener('change', event => {
  customOrderState.selectedProductId = event.target.value || '';
  const product = customOrderState.products.find(item => item.id === customOrderState.selectedProductId);
  if (product) {
    pushChatMessage('assistant', `Modelo base seleccionado: ${product.name}. Dime qué quieres cambiar y cuántas piezas necesitas.`);
    refreshCustomOrderAnalysis();
  } else {
    refreshCustomOrderAnalysis();
  }
});
document.getElementById('referenceStrip')?.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-reference]');
  if (!button) return;
  const index = Number(button.dataset.removeReference);
  customOrderState.referenceImages.splice(index, 1);
  renderReferences();
  refreshCustomOrderAnalysis();
});
document.addEventListener('click', closeCustomerMenu);
initPersonalizado();
