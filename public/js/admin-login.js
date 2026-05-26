function getNextUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/admin';
  return next.startsWith('/') ? next : '/admin';
}

function showAdminLoginMessage(message, type) {
  const box = document.getElementById('adminLoginMessage');
  if (!box) return;

  box.style.display = 'flex';
  box.className = type === 'error' ? 'notice-box notice-error' : 'notice-box';
  box.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i><span>${message}</span>`;
}

async function submitAdminLogin(event) {
  event.preventDefault();

  const email = document.getElementById('adminEmailInput')?.value.trim();
  const password = document.getElementById('adminPasswordInput')?.value || '';
  const button = document.getElementById('adminLoginBtn');

  if (!email || !password) {
    showAdminLoginMessage('Correo y contraseña son obligatorios.', 'error');
    return;
  }

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Validando acceso';
  }

  try {
    const response = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'No se pudo iniciar sesión.');
    }

    window.location.href = getNextUrl();
  } catch (error) {
    showAdminLoginMessage(error.message, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar al admin';
    }
  }
}

document.getElementById('adminLoginForm')?.addEventListener('submit', submitAdminLogin);
