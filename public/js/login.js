const DEFAULT_LOGIN_NEXT = '/cuenta';

function hasExplicitNext() {
  return new URLSearchParams(window.location.search).has('next');
}

function getNextUrl() {
  const next = new URLSearchParams(window.location.search).get('next') || DEFAULT_LOGIN_NEXT;
  if (!next.startsWith('/') || next.startsWith('//')) return DEFAULT_LOGIN_NEXT;
  return next;
}

function getLoginContext() {
  const next = getNextUrl();
  if (next === '/pedido') return 'pedido';
  if (next === '/personalizado') return 'personalizado';
  return 'normal';
}

function showNotice(message, type = 'info') {
  const box = document.getElementById('loginNotice');
  const text = document.getElementById('loginNoticeText');
  if (!box || !text) return;

  box.style.display = 'flex';
  box.dataset.type = type;
  text.textContent = message;
}

async function authRequest(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || 'No se pudo completar el acceso.');
  }

  return data;
}

function setButtonLoading(button, loadingText) {
  if (!button) return function noop() {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
  return function restore() {
    button.disabled = false;
    button.innerHTML = original;
  };
}

function applyLoginCopy() {
  const context = getLoginContext();
  const title = document.getElementById('loginPanelTitle');
  const subtitle = document.getElementById('loginPanelSubtitle');
  const loginButtonText = document.getElementById('loginButtonText');
  const registerButtonText = document.getElementById('registerButtonText');
  const heroTitle = document.getElementById('loginHeroTitle');
  const heroCopy = document.getElementById('loginHeroCopy');

  if (context === 'pedido') {
    if (heroTitle) heroTitle.textContent = 'Identifícate para revisar tu pedido.';
    if (heroCopy) heroCopy.textContent = 'Tu carrito sigue guardado. Al entrar volverás a la revisión del pedido; no se enviará nada hasta que presiones Crear pedido.';
    if (title) title.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Continuar pedido';
    if (subtitle) subtitle.textContent = 'Inicia sesión o crea una cuenta rápida. Después revisarás el carrito antes de confirmarlo.';
    if (loginButtonText) loginButtonText.textContent = 'Entrar y revisar pedido';
    if (registerButtonText) registerButtonText.textContent = 'Crear cuenta y revisar pedido';
    showNotice('El pedido no se crea al iniciar sesión. Primero verás el resumen y lo confirmarás manualmente.', 'info');
    return;
  }

  if (context === 'personalizado') {
    if (heroTitle) heroTitle.textContent = 'Las personalizaciones viven dentro de tu cuenta.';
    if (heroCopy) heroCopy.textContent = 'Esta sección se reserva para clientes identificados, porque después tendrá reglas, historial y revisión del admin.';
    if (title) title.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Entrar a personalización';
    if (subtitle) subtitle.textContent = 'Inicia sesión o crea tu cuenta para preparar solicitudes personalizadas.';
    if (loginButtonText) loginButtonText.textContent = 'Entrar a personalizado';
    if (registerButtonText) registerButtonText.textContent = 'Crear cuenta y continuar';
    return;
  }

  if (heroTitle) heroTitle.textContent = 'Tu cuenta guarda pedidos, historial y futuras personalizaciones.';
  if (heroCopy) heroCopy.textContent = 'El catálogo sigue abierto sin login. Esta entrada normal lleva a tu panel de comprador, no manda ningún carrito automáticamente.';
  if (title) title.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Ingresar a mi cuenta';
  if (subtitle) subtitle.textContent = 'Entra para ver tu dashboard de comprador, revisar pedidos y preparar futuras personalizaciones.';
  if (loginButtonText) loginButtonText.textContent = 'Entrar a mi cuenta';
  if (registerButtonText) registerButtonText.textContent = 'Crear cuenta de comprador';
}

async function checkExistingSession() {
  try {
    const response = await fetch('/api/auth/customer/me', {
      credentials: 'same-origin'
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok) {
      showNotice('Ya tienes sesión activa. Te llevo a la sección correcta.', 'success');
      window.setTimeout(() => {
        window.location.href = getNextUrl();
      }, 450);
    }
  } catch (error) {
    // No hay sesión o no se pudo validar; la pantalla sigue normal.
  }
}

async function loginCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const restore = setButtonLoading(button, 'Entrando...');

  try {
    await authRequest('/api/auth/customer/login', {
      email: form.email.value,
      password: form.password.value,
      next: getNextUrl()
    });

    window.location.href = getNextUrl();
  } catch (error) {
    showNotice(error.message || 'No se pudo iniciar sesión.', 'error');
  } finally {
    restore();
  }
}

async function registerCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const restore = setButtonLoading(button, 'Creando cuenta...');

  try {
    await authRequest('/api/auth/customer/register', {
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      password: form.password.value,
      next: getNextUrl()
    });

    window.location.href = getNextUrl();
  } catch (error) {
    showNotice(error.message || 'No se pudo crear la cuenta.', 'error');
  } finally {
    restore();
  }
}

document.getElementById('loginForm')?.addEventListener('submit', loginCustomer);
document.getElementById('registerForm')?.addEventListener('submit', registerCustomer);
applyLoginCopy();
checkExistingSession();
