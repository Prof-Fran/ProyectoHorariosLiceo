// ============================================================
// ui.js — Funciones de renderizado reutilizables
// Actualización dinámica de la interfaz sin recarga de página
// Depende de: estilos.css (clases de componentes)
// ============================================================

const UI = (() => {

  // ── Contenedor de toasts (se crea una sola vez) ──────────────
  let _toastContainer = null;

  /**
   * Obtiene o crea el contenedor de toasts en el DOM.
   * @returns {HTMLElement}
   */
  function _obtenerToastContainer() {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = 'toast-container';
      document.body.appendChild(_toastContainer);
    }
    return _toastContainer;
  }

  // ── Toasts / Notificaciones ──────────────────────────────────

  /**
   * Muestra una notificación temporal en la esquina inferior derecha.
   * @param {string} mensaje - Texto del mensaje
   * @param {'success'|'error'|'warning'|'info'} tipo - Tipo de notificación
   * @param {number} duracion - Duración en ms (default: 3500)
   */
  function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
    const iconos = {
      success: 'fa-solid fa-circle-check',
      error:   'fa-solid fa-circle-xmark',
      warning: 'fa-solid fa-triangle-exclamation',
      info:    'fa-solid fa-circle-info',
    };

    const contenedor = _obtenerToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
      <i class="${iconos[tipo] || iconos.info}" aria-hidden="true"></i>
      <span>${_escaparHTML(mensaje)}</span>
    `;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    contenedor.appendChild(toast);

    // Auto-dismiss con animación de salida
    const timer = setTimeout(() => _cerrarToast(toast), duracion);

    // Click para cerrar
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      _cerrarToast(toast);
    });
  }

  /**
   * Anima la salida del toast y lo elimina del DOM.
   * @param {HTMLElement} toast
   */
  function _cerrarToast(toast) {
    toast.classList.add('saliendo');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  // ── Modal de confirmación ────────────────────────────────────

  /**
   * Muestra un modal de confirmación y retorna una Promise<boolean>.
   * @param {string} titulo - Título del modal
   * @param {string} mensaje - Mensaje descriptivo
   * @param {Object} opciones - Opciones opcionales
   * @param {string} opciones.labelConfirmar - Texto del botón confirmar (default: 'Confirmar')
   * @param {string} opciones.labelCancelar  - Texto del botón cancelar  (default: 'Cancelar')
   * @param {'danger'|'primary'} opciones.variante - Variante del botón confirmar
   * @returns {Promise<boolean>}
   */
  function confirmar(titulo, mensaje, opciones = {}) {
    const {
      labelConfirmar = 'Confirmar',
      labelCancelar  = 'Cancelar',
      variante       = 'danger',
    } = opciones;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'modal-confirmar-titulo');

      const iconoVariante = variante === 'danger'
        ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-circle-info" style="color:var(--info)" aria-hidden="true"></i>';

      overlay.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:.65rem;">
              ${iconoVariante}
              <span class="modal-titulo" id="modal-confirmar-titulo">${_escaparHTML(titulo)}</span>
            </div>
            <button class="modal-cerrar" id="modal-btn-cerrar" aria-label="Cerrar modal">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="modal-body">
            <p style="font-size:var(--text-base);color:var(--text-muted);line-height:1.7;">
              ${_escaparHTML(mensaje)}
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-btn-cancelar">
              ${_escaparHTML(labelCancelar)}
            </button>
            <button class="btn btn-${variante}" id="modal-btn-confirmar">
              ${variante === 'danger'
                ? '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-check" aria-hidden="true"></i>'}
              ${_escaparHTML(labelConfirmar)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Foco en el botón cancelar por seguridad
      requestAnimationFrame(() => {
        overlay.querySelector('#modal-btn-cancelar')?.focus();
      });

      const resolver = (valor) => {
        overlay.style.animation = 'none';
        overlay.style.opacity   = '0';
        overlay.style.transition = 'opacity 0.18s ease';
        setTimeout(() => overlay.remove(), 200);
        resolve(valor);
      };

      overlay.querySelector('#modal-btn-confirmar')?.addEventListener('click', () => resolver(true));
      overlay.querySelector('#modal-btn-cancelar')?.addEventListener('click',  () => resolver(false));
      overlay.querySelector('#modal-btn-cerrar')?.addEventListener('click',    () => resolver(false));

      // Cerrar con Escape
      const onKeydown = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKeydown); resolver(false); }
      };
      document.addEventListener('keydown', onKeydown);

      // Cerrar haciendo clic fuera
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) resolver(false);
      });
    });
  }

  // ── Renderizado de tabla genérica ────────────────────────────

  /**
   * Renderiza una tabla de datos dentro de un contenedor.
   * @param {HTMLElement} contenedor - Elemento donde se renderiza
   * @param {Array<{key:string, label:string, render?:Function}>} columnas
   * @param {Array<Object>} filas - Array de objetos de datos
   * @param {Object} opciones
   * @param {Function} opciones.acciones - Función que recibe (fila) y retorna HTML string de acciones
   * @param {string}   opciones.idVacio  - Ícono Font Awesome para estado vacío
   * @param {string}   opciones.textoVacio - Texto del estado vacío
   */
  function renderizarTabla(contenedor, columnas, filas, opciones = {}) {
    const {
      acciones   = null,
      idVacio    = 'fa-solid fa-inbox',
      textoVacio = 'No hay registros para mostrar.',
    } = opciones;

    if (!filas || filas.length === 0) {
      contenedor.innerHTML = `
        <div class="estado-vacio">
          <i class="${idVacio}" aria-hidden="true"></i>
          <p>${_escaparHTML(textoVacio)}</p>
        </div>
      `;
      return;
    }

    // Encabezados
    const thHTML = columnas.map(col =>
      `<th>${_escaparHTML(col.label)}</th>`
    ).join('');

    const thAcciones = acciones ? `<th class="col-acciones">Acciones</th>` : '';

    // Filas
    const tbodyHTML = filas.map(fila => {
      const tdsHTML = columnas.map(col => {
        const valor = col.render ? col.render(fila) : _escaparHTML(String(fila[col.key] ?? ''));
        return `<td>${valor}</td>`;
      }).join('');

      const tdAcciones = acciones
        ? `<td class="col-acciones"><div class="fila-acciones">${acciones(fila)}</div></td>`
        : '';

      return `<tr>${tdsHTML}${tdAcciones}</tr>`;
    }).join('');

    contenedor.innerHTML = `
      <div class="tabla-contenedor">
        <table class="tabla-datos">
          <thead>
            <tr>${thHTML}${thAcciones}</tr>
          </thead>
          <tbody>
            ${tbodyHTML}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Estado vacío ─────────────────────────────────────────────

  /**
   * Renderiza un estado vacío estilizado dentro de un contenedor.
   * @param {HTMLElement} contenedor
   * @param {string} icono - Clase de Font Awesome
   * @param {string} titulo - Texto principal
   * @param {string} subtitulo - Texto secundario (opcional)
   * @param {string} htmlAccion - HTML de botón de acción opcional
   */
  function renderizarVacio(contenedor, icono, titulo, subtitulo = '', htmlAccion = '') {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <i class="${icono}" aria-hidden="true"></i>
        <h3>${_escaparHTML(titulo)}</h3>
        ${subtitulo ? `<p>${_escaparHTML(subtitulo)}</p>` : ''}
        ${htmlAccion}
      </div>
    `;
  }

  // ── Spinner de carga ─────────────────────────────────────────

  /**
   * Muestra un spinner de carga centrado dentro del contenedor.
   * @param {HTMLElement} contenedor
   * @param {string} texto - Texto descriptivo opcional
   */
  function mostrarCargando(contenedor, texto = 'Cargando...') {
    contenedor.innerHTML = `
      <div class="cargando-overlay" aria-live="polite" aria-busy="true">
        <div class="spinner" role="status" aria-label="${_escaparHTML(texto)}"></div>
        <span>${_escaparHTML(texto)}</span>
      </div>
    `;
  }

  /**
   * Limpia el contenido del contenedor (usado después de mostrarCargando).
   * @param {HTMLElement} contenedor
   */
  function ocultarCargando(contenedor) {
    contenedor.innerHTML = '';
  }

  // ── Badge HTML ───────────────────────────────────────────────

  /**
   * Genera el HTML de un badge de estado.
   * @param {'verde'|'rojo'|'azul'|'gris'|'amarillo'|'accent'} tipo
   * @param {string} texto
   * @param {string} icono - Clase Font Awesome opcional
   * @returns {string} HTML string
   */
  function badge(tipo, texto, icono = '') {
    const iconoHTML = icono ? `<i class="${icono}" aria-hidden="true"></i>` : '';
    return `<span class="badge badge-${tipo}">${iconoHTML}${_escaparHTML(texto)}</span>`;
  }

  // ── Botones de acción de tabla ────────────────────────────────

  /**
   * Genera HTML del botón editar para tablas.
   * @param {string|number} id
   * @param {string} titulo - Texto del aria-label
   * @returns {string} HTML string
   */
  function btnEditar(id, titulo = 'Editar') {
    return `
      <button class="btn-icono btn-icono-editar"
              data-id="${id}"
              data-accion="editar"
              title="${_escaparHTML(titulo)}"
              aria-label="${_escaparHTML(titulo)}">
        <i class="fa-solid fa-pen" aria-hidden="true"></i>
      </button>
    `;
  }

  /**
   * Genera HTML del botón eliminar para tablas.
   * @param {string|number} id
   * @param {string} titulo - Texto del aria-label
   * @returns {string} HTML string
   */
  function btnEliminar(id, titulo = 'Eliminar') {
    return `
      <button class="btn-icono btn-icono-eliminar"
              data-id="${id}"
              data-accion="eliminar"
              title="${_escaparHTML(titulo)}"
              aria-label="${_escaparHTML(titulo)}">
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
      </button>
    `;
  }

  /**
   * Genera HTML del botón ver/detalle para tablas.
   * @param {string|number} id
   * @param {string} titulo - Texto del aria-label
   * @returns {string} HTML string
   */
  function btnVer(id, titulo = 'Ver detalle') {
    return `
      <button class="btn-icono btn-icono-ver"
              data-id="${id}"
              data-accion="ver"
              title="${_escaparHTML(titulo)}"
              aria-label="${_escaparHTML(titulo)}">
        <i class="fa-solid fa-eye" aria-hidden="true"></i>
      </button>
    `;
  }

  // ── Mensaje de error de API ───────────────────────────────────

  /**
   * Extrae y formatea el mensaje de error de una respuesta de API o excepción.
   * @param {Error|Response|Object|string} error
   * @returns {string} Mensaje legible para el usuario
   */
  function mensajeError(error) {
    if (!error) return 'Ocurrió un error inesperado.';

    if (typeof error === 'string') return error;

    if (error?.mensaje) return error.mensaje;
    if (error?.message) {
      // Ocultar errores técnicos de red
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        return 'No se pudo conectar con el servidor. Verificá que esté corriendo.';
      }
      return error.message;
    }

    return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }

  // ── Barra de progreso HTML ────────────────────────────────────

  /**
   * Genera el HTML de una barra de progreso de horas.
   * @param {number} asignadas - Horas asignadas
   * @param {number} total     - Total de horas
   * @returns {string} HTML string
   */
  function barraProgreso(asignadas, total) {
    const porcentaje = total > 0 ? Math.min(100, Math.round((asignadas / total) * 100)) : 0;
    const restantes  = Math.max(0, total - asignadas);

    let claseExtra = '';
    if (porcentaje >= 100) claseExtra = 'llena';
    else if (porcentaje >= 80) claseExtra = 'casi-llena';

    return `
      <div class="barra-progreso-wrap">
        <div class="barra-progreso-info">
          <span>${asignadas} / ${total} hs asignadas</span>
          <span style="color:${restantes === 0 ? 'var(--error-text)' : 'var(--accent-hover)'}">
            ${restantes} hs restantes
          </span>
        </div>
        <div class="barra-progreso" role="progressbar"
             aria-valuenow="${asignadas}" aria-valuemin="0" aria-valuemax="${total}">
          <div class="barra-progreso-fill ${claseExtra}"
               style="width:${porcentaje}%"></div>
        </div>
      </div>
    `;
  }

  // ── Confirmación de eliminación (atajo) ──────────────────────

  /**
   * Muestra el modal de confirmación de eliminación estándar.
   * @param {string} entidad - Nombre de lo que se elimina (ej: 'el nivel "7°"')
   * @returns {Promise<boolean>}
   */
  function confirmarEliminacion(entidad) {
    return confirmar(
      'Confirmar eliminación',
      `¿Estás seguro de que querés eliminar ${entidad}? Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );
  }

  // ── Header de módulo HTML ────────────────────────────────────

  /**
   * Genera el HTML del encabezado estándar de un módulo.
   * @param {string} titulo - Título del módulo
   * @param {string} subtitulo - Subtítulo descriptivo
   * @param {string} htmlAcciones - HTML de botones de acción
   * @returns {string} HTML string
   */
  function headerModulo(titulo, subtitulo = '', htmlAcciones = '') {
    return `
      <div class="modulo-header">
        <div class="modulo-header-left">
          <h2 class="modulo-titulo">${_escaparHTML(titulo)}</h2>
          ${subtitulo ? `<p class="modulo-subtitulo">${_escaparHTML(subtitulo)}</p>` : ''}
        </div>
        ${htmlAcciones ? `<div class="modulo-acciones">${htmlAcciones}</div>` : ''}
      </div>
    `;
  }

  // ── Utilidad interna: escapar HTML ───────────────────────────

  /**
   * Escapa caracteres especiales HTML para prevenir XSS.
   * @param {string} texto
   * @returns {string}
   */
  function _escaparHTML(texto) {
    if (texto == null) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── API Pública ──────────────────────────────────────────────
  return {
    mostrarToast,
    confirmar,
    confirmarEliminacion,
    renderizarTabla,
    renderizarVacio,
    mostrarCargando,
    ocultarCargando,
    badge,
    btnEditar,
    btnEliminar,
    btnVer,
    mensajeError,
    barraProgreso,
    headerModulo,
  };

})();
