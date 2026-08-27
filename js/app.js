// ============================================================
// app.js — Punto de entrada principal
// Gestiona la autenticación y la navegación
// entre módulos sin recargar la página
// ============================================================

const App = (() => {

  // ── Configuración ────────────────────────────────────────────
  const CREDENCIALES = { usuario: 'Admin', password: '905011_Yo' };
  const SESSION_KEY  = 'horarios_sesion';
  const API_BASE     = 'http://localhost:3000/api';

  // ── Utilidades de sesión ─────────────────────────────────────

  /** Guarda la sesión en sessionStorage */
  function guardarSesion(usuario) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ usuario, ts: Date.now() }));
  }

  /** Elimina la sesión */
  function eliminarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /** Devuelve los datos de sesión o null si no hay sesión activa */
  function obtenerSesion() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Devuelve true si hay una sesión activa válida */
  function estaAutenticado() {
    return obtenerSesion() !== null;
  }

  // ── Navegación ───────────────────────────────────────────────

  /**
   * Redirige a index.html si no hay sesión activa.
   * Llamar al inicio de dashboard.html.
   */
  function init() {
    if (!estaAutenticado()) {
      window.location.replace('index.html');
      return;
    }
    // Mostrar el nombre del usuario en el sidebar
    const sesion = obtenerSesion();
    const elUser = document.getElementById('sidebar-username');
    if (elUser && sesion?.usuario) elUser.textContent = sesion.usuario;
  }

  /**
   * Navega a un módulo sin recargar la página.
   * @param {string} modulo - Nombre del módulo ('niveles', 'grupos', etc.)
   */
  function navegarA(modulo) {
    // Actualizar clase activa en nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modulo === modulo);
    });

    // Actualizar título de la topbar
    const titulos = {
      niveles:        'Niveles',
      turnos:         'Turnos y Horarios',
      grupos:         'Grupos',
      asignaturas:    'Asignaturas',
      docentes:       'Docentes',
      disponibilidad: 'Disponibilidad Docente',
      armado:         'Armado de Horarios',
    };
    const el = document.getElementById('topbar-titulo');
    if (el) el.textContent = titulos[modulo] || modulo;

    // Cargar el módulo correspondiente
    const contenedor = document.getElementById('modulo-contenido');
    if (!contenedor) return;

    // Llamar a la función de renderizado del módulo si existe
    // (será implementada en Fase 6)
    const fnModulo = window[`Modulo_${modulo}`];
    if (fnModulo && typeof fnModulo.render === 'function') {
      fnModulo.render(contenedor);
    } else {
      contenedor.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:60vh;gap:1rem;color:#94a3b8;text-align:center;">
          <i class="fa-solid fa-hammer" style="font-size:2.5rem;color:rgba(99,102,241,.25);"></i>
          <p style="font-size:.9rem;">El módulo <strong style="color:#f1f5f9;">${titulos[modulo] || modulo}</strong>
             está en desarrollo.</p>
        </div>
      `;
    }
  }

  // ── Logout ───────────────────────────────────────────────────

  /**
   * Cierra la sesión y redirige al login.
   */
  function logout() {
    eliminarSesion();
    window.location.replace('index.html');
  }

  // ── Verificación del servidor ─────────────────────────────────

  /**
   * Verifica si el servidor Express está corriendo.
   * Actualiza el indicador visual en el topbar.
   */
  async function verificarServidor() {
    const dot   = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    if (!dot || !label) return;

    try {
      const res = await fetch(`${API_BASE}/estado`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        dot.classList.remove('offline');
        label.textContent = 'Servidor conectado';
      } else {
        throw new Error('not ok');
      }
    } catch {
      dot.classList.add('offline');
      label.textContent = 'Servidor desconectado';
    }
  }

  // ── Login (usado desde index.html) ───────────────────────────

  /**
   * Valida las credenciales y redirige al dashboard.
   * @param {string} usuario
   * @param {string} password
   * @returns {{ ok: boolean, mensaje?: string }}
   */
  function login(usuario, password) {
    if (
      usuario.trim() === CREDENCIALES.usuario &&
      password       === CREDENCIALES.password
    ) {
      guardarSesion(usuario.trim());
      return { ok: true };
    }
    return { ok: false, mensaje: 'Usuario o contraseña incorrectos.' };
  }

  // ── Inicialización del formulario de login ───────────────────

  /**
   * Asocia los eventos al formulario de login.
   * Llamar cuando el DOM de index.html está listo.
   */
  function initLogin() {
    // Si ya está autenticado, ir directo al dashboard
    if (estaAutenticado()) {
      window.location.replace('dashboard.html');
      return;
    }

    const form       = document.getElementById('form-login');
    const inputUser  = document.getElementById('input-usuario');
    const inputPass  = document.getElementById('input-password');
    const errorBox   = document.getElementById('login-error');
    const errorMsg   = document.getElementById('login-error-msg');
    const btnSubmit  = document.getElementById('btn-submit');
    const btnToggle  = document.getElementById('btn-toggle-pass');
    const iconEye    = document.getElementById('icon-eye');

    if (!form) return; // No estamos en la página de login

    // Toggle visibilidad de contraseña
    btnToggle?.addEventListener('click', () => {
      const esPassword = inputPass.type === 'password';
      inputPass.type = esPassword ? 'text' : 'password';
      iconEye.className = esPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    // Ocultar error al escribir
    [inputUser, inputPass].forEach(el => {
      el?.addEventListener('input', () => {
        errorBox?.classList.remove('visible');
      });
    });

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const usuario  = inputUser?.value || '';
      const password = inputPass?.value || '';

      // Mostrar spinner
      btnSubmit?.classList.add('loading');
      btnSubmit.disabled = true;

      // Simular pequeño delay para UX
      await new Promise(r => setTimeout(r, 400));

      const resultado = login(usuario, password);

      if (resultado.ok) {
        // Redirigir al dashboard
        window.location.replace('dashboard.html');
      } else {
        // Mostrar error
        if (errorMsg) errorMsg.textContent = resultado.mensaje;
        errorBox?.classList.add('visible');
        inputPass.value = '';
        inputPass.focus();
      }

      btnSubmit?.classList.remove('loading');
      btnSubmit.disabled = false;
    });
  }

  // ── API Pública ──────────────────────────────────────────────
  return {
    init,
    initLogin,
    navegarA,
    logout,
    verificarServidor,
    estaAutenticado,
    obtenerSesion,
    API_BASE,
  };

})();

// Inicializar automáticamente el formulario de login si estamos en index.html
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('form-login')) {
    App.initLogin();
  }
});
