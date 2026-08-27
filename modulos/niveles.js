// ============================================================
// modulos/niveles.js — Módulo CRUD de Niveles
// Fase 6: Gestión completa de niveles educativos
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/formularios.css
// ============================================================

window.Modulo_niveles = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor    = null;  // Elemento raíz donde se renderiza
  let _niveles       = [];    // Cache de niveles cargados
  let _nivelEditando = null;  // null = creando / objeto = editando

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_API = () => `${App.API_BASE}/niveles`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  /**
   * Punto de entrada: renderiza el módulo en el contenedor dado.
   * Llamado por App.navegarA('niveles').
   * @param {HTMLElement} contenedor
   */
  async function render(contenedor) {
    _contenedor = contenedor;

    // Estructura base del módulo
    _contenedor.innerHTML = `
      <div class="modulo-layout-split" id="niveles-layout">

        <!-- ── Columna izquierda: lista ── -->
        <div class="modulo-col-lista" id="niveles-col-lista">

          ${UI.headerModulo(
            'Niveles',
            'Niveles educativos disponibles en el sistema',
            `<button class="btn btn-primary" id="btn-nuevo-nivel">
               <i class="fa-solid fa-plus" aria-hidden="true"></i>
               Nuevo nivel
             </button>`
          )}

          <!-- Tabla / contenido dinámico -->
          <div id="niveles-tabla-wrap"></div>

        </div>

        <!-- ── Columna derecha: formulario (oculto por defecto) ── -->
        <div class="modulo-col-form oculta" id="niveles-col-form">
          ${_htmlFormulario()}
        </div>

      </div>
    `;

    // Agregar layout split al CSS dinámico si no existe
    _inyectarEstilos();

    // Eventos estáticos
    document.getElementById('btn-nuevo-nivel')
      ?.addEventListener('click', _abrirFormularioNuevo);

    // Cargar datos
    await _cargarNiveles();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  /**
   * Obtiene los niveles de la API y renderiza la tabla.
   */
  async function _cargarNiveles() {
    const wrap = document.getElementById('niveles-tabla-wrap');
    if (!wrap) return;

    UI.mostrarCargando(wrap, 'Cargando niveles...');

    try {
      const res = await fetch(URL_API());
      if (!res.ok) throw new Error('Error al obtener niveles');
      _niveles = await res.json();
      _renderizarTabla();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  // ════════════════════════════════════════════════════════════
  //  TABLA DE NIVELES
  // ════════════════════════════════════════════════════════════

  /**
   * Renderiza la tabla de niveles usando UI.renderizarTabla.
   */
  function _renderizarTabla() {
    const wrap = document.getElementById('niveles-tabla-wrap');
    if (!wrap) return;

    UI.renderizarTabla(
      wrap,
      [
        {
          key:    'id',
          label:  '#',
          render: (fila) => `<span class="text-muted">${fila.id}</span>`,
        },
        {
          key:   'nombre',
          label: 'Nombre del nivel',
          render: (fila) => `
            <span style="font-weight:600;color:var(--text);">${_esc(fila.nombre)}</span>
          `,
        },
      ],
      _niveles,
      {
        idVacio:    'fa-solid fa-layer-group',
        textoVacio: 'No hay niveles registrados. Creá el primero.',
        acciones: (fila) =>
          UI.btnEditar(fila.id, `Editar nivel "${fila.nombre}"`) +
          UI.btnEliminar(fila.id, `Eliminar nivel "${fila.nombre}"`),
      }
    );

    // Eventos en los botones de la tabla (delegación en el wrap)
    wrap.addEventListener('click', _manejarClickTabla, { once: true });
  }

  /**
   * Maneja clics en botones editar/eliminar de la tabla.
   * @param {MouseEvent} e
   */
  function _manejarClickTabla(e) {
    const wrap = document.getElementById('niveles-tabla-wrap');

    const boton = e.target.closest('[data-accion]');
    if (!boton) {
      // Si no fue un botón de acción, re-asignar listener
      wrap?.addEventListener('click', _manejarClickTabla, { once: true });
      return;
    }

    const { id, accion } = boton.dataset;
    const nivelId = Number(id);
    const nivel   = _niveles.find(n => n.id === nivelId);

    if (!nivel) {
      wrap?.addEventListener('click', _manejarClickTabla, { once: true });
      return;
    }

    if (accion === 'editar') {
      _abrirFormularioEditar(nivel);
    } else if (accion === 'eliminar') {
      _confirmarEliminar(nivel);
    }

    // Re-asignar listener para próximos clics
    wrap?.addEventListener('click', _manejarClickTabla, { once: true });
  }

  // ════════════════════════════════════════════════════════════
  //  FORMULARIO (HTML)
  // ════════════════════════════════════════════════════════════

  /**
   * Genera el HTML del panel de formulario.
   * @returns {string}
   */
  function _htmlFormulario() {
    return `
      <div class="form-panel" id="nivel-form-panel">

        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo" id="nivel-form-titulo">Nuevo nivel</span>
        </div>

        <form id="form-nivel" novalidate autocomplete="off">

          <div class="form-panel-body">

            <!-- Caja de error general -->
            <div class="form-error-box" id="nivel-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="nivel-error-msg"></span>
            </div>

            <!-- Campo: Nombre -->
            <div class="campo-grupo">
              <label class="campo-label" for="nivel-input-nombre">
                Nombre <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-layer-group input-icono-izq" aria-hidden="true"></i>
                <input
                  id="nivel-input-nombre"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: 7°, 8°, 1° EMS"
                  maxlength="60"
                  required
                  aria-required="true"
                />
              </div>
              <span class="campo-ayuda">
                Ingresá el nombre del nivel tal como aparecerá en el sistema.
              </span>
              <span class="campo-error" id="nivel-error-nombre" aria-live="polite" style="display:none">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                El nombre es obligatorio.
              </span>
            </div>

          </div><!-- /form-panel-body -->

          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="nivel-btn-cancelar">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" id="nivel-btn-guardar">
              <span class="btn-text">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                Guardar
              </span>
              <div class="btn-spinner" aria-hidden="true"></div>
            </button>
          </div>

        </form>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  APERTURA / CIERRE DEL FORMULARIO
  // ════════════════════════════════════════════════════════════

  /** Abre el formulario en modo creación. */
  function _abrirFormularioNuevo() {
    _nivelEditando = null;
    _limpiarFormulario();
    _setTituloFormulario('Nuevo nivel');
    _mostrarFormulario();

    // Foco en el input
    setTimeout(() => document.getElementById('nivel-input-nombre')?.focus(), 100);
  }

  /**
   * Abre el formulario en modo edición con los datos del nivel.
   * @param {{ id: number, nombre: string }} nivel
   */
  function _abrirFormularioEditar(nivel) {
    _nivelEditando = nivel;
    _limpiarFormulario();
    _setTituloFormulario(`Editar nivel`);

    // Pre-llenar campos
    const inputNombre = document.getElementById('nivel-input-nombre');
    if (inputNombre) inputNombre.value = nivel.nombre;

    _mostrarFormulario();
    setTimeout(() => inputNombre?.focus(), 100);
  }

  /** Muestra el panel de formulario y conecta eventos. */
  function _mostrarFormulario() {
    const col = document.getElementById('niveles-col-form');
    col?.classList.remove('oculta');

    // Conectar eventos del formulario (una sola vez)
    document.getElementById('nivel-btn-cancelar')
      ?.addEventListener('click', _cerrarFormulario, { once: true });

    document.getElementById('form-nivel')
      ?.addEventListener('submit', _manejarEnvio, { once: true });

    // Limpiar error al escribir
    document.getElementById('nivel-input-nombre')
      ?.addEventListener('input', _ocultarErrores);
  }

  /** Oculta el panel de formulario y resetea estado. */
  function _cerrarFormulario() {
    const col = document.getElementById('niveles-col-form');
    col?.classList.add('oculta');
    _nivelEditando = null;
    _limpiarFormulario();
  }

  /** Resetea campos y mensajes de error del formulario. */
  function _limpiarFormulario() {
    const input = document.getElementById('nivel-input-nombre');
    if (input) {
      input.value = '';
      input.classList.remove('error');
    }
    _ocultarErrores();
  }

  /** Oculta todos los mensajes de error inline y el banner. */
  function _ocultarErrores() {
    document.getElementById('nivel-error-box')?.classList.remove('visible');
    const errNombre = document.getElementById('nivel-error-nombre');
    if (errNombre) errNombre.style.display = 'none';
    document.getElementById('nivel-input-nombre')?.classList.remove('error');
  }

  /** Actualiza el título del panel de formulario. */
  function _setTituloFormulario(texto) {
    const el = document.getElementById('nivel-form-titulo');
    if (el) el.textContent = texto;
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO (CREAR / ACTUALIZAR)
  // ════════════════════════════════════════════════════════════

  /**
   * Maneja el envío del formulario de nivel.
   * @param {SubmitEvent} e
   */
  async function _manejarEnvio(e) {
    e.preventDefault();
    _ocultarErrores();

    const inputNombre = document.getElementById('nivel-input-nombre');
    const nombre      = inputNombre?.value.trim() || '';

    // Validación cliente
    if (!nombre) {
      _mostrarErrorCampo('nivel-error-nombre', 'nivel-input-nombre');
      inputNombre?.focus();
      // Re-asignar el listener porque usamos once:true
      document.getElementById('form-nivel')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
      return;
    }

    // Estado de carga en el botón
    const btnGuardar = document.getElementById('nivel-btn-guardar');
    btnGuardar?.classList.add('loading');
    btnGuardar && (btnGuardar.disabled = true);

    try {
      if (_nivelEditando) {
        await _actualizarNivel(_nivelEditando.id, nombre);
      } else {
        await _crearNivel(nombre);
      }
    } catch (error) {
      // Re-asignar listener si hubo error
      document.getElementById('form-nivel')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
    } finally {
      btnGuardar?.classList.remove('loading');
      btnGuardar && (btnGuardar.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD (llamadas a la API)
  // ════════════════════════════════════════════════════════════

  /**
   * Crea un nivel nuevo via POST.
   * @param {string} nombre
   */
  async function _crearNivel(nombre) {
    const res = await fetch(URL_API(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    });

    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo crear el nivel.');
      throw new Error(datos.error);
    }

    // Éxito: agregar al cache local y actualizar tabla
    _niveles.push(datos);
    _niveles.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    _renderizarTabla();
    _cerrarFormulario();
    UI.mostrarToast(`Nivel "${datos.nombre}" creado correctamente.`, 'success');
  }

  /**
   * Actualiza un nivel via PUT.
   * @param {number} id
   * @param {string} nombre
   */
  async function _actualizarNivel(id, nombre) {
    const res = await fetch(`${URL_API()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    });

    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo actualizar el nivel.');
      throw new Error(datos.error);
    }

    // Éxito: actualizar cache local y tabla
    const idx = _niveles.findIndex(n => n.id === id);
    if (idx !== -1) _niveles[idx] = datos;
    _niveles.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    _renderizarTabla();
    _cerrarFormulario();
    UI.mostrarToast(`Nivel "${datos.nombre}" actualizado correctamente.`, 'success');
  }

  /**
   * Elimina un nivel via DELETE, con confirmación previa y
   * advertencia si el nivel tiene grupos asociados.
   * @param {{ id: number, nombre: string }} nivel
   */
  async function _confirmarEliminar(nivel) {
    // Verificar si tiene grupos antes de confirmar
    let tieneGrupos = false;
    try {
      const res = await fetch(`${App.API_BASE}/grupos/por_nivel/${nivel.id}`);
      if (res.ok) {
        const grupos = await res.json();
        tieneGrupos = grupos.length > 0;
      }
    } catch { /* si falla la verificación, continuamos igual */ }

    // Construir el mensaje según si tiene grupos o no
    const mensaje = tieneGrupos
      ? `⚠️ El nivel "${nivel.nombre}" tiene grupos asociados.\n\nSi lo eliminás, se eliminarán también todos los grupos, asignaturas y horarios relacionados. ¿Estás seguro?`
      : `¿Estás seguro de que querés eliminar el nivel "${nivel.nombre}"? Esta acción no se puede deshacer.`;

    const confirmado = await UI.confirmar(
      'Eliminar nivel',
      mensaje,
      {
        labelConfirmar: 'Eliminar',
        variante:       'danger',
      }
    );

    if (!confirmado) return;

    // Ejecutar el DELETE
    try {
      const res = await fetch(`${URL_API()}/${nivel.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar el nivel.', 'error');
        return;
      }

      // Éxito: quitar del cache y actualizar tabla
      _niveles = _niveles.filter(n => n.id !== nivel.id);
      _renderizarTabla();

      // Si se estaba editando este nivel, cerrar el formulario
      if (_nivelEditando?.id === nivel.id) _cerrarFormulario();

      UI.mostrarToast(`Nivel "${nivel.nombre}" eliminado.`, 'success');

    } catch (error) {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES DE UI
  // ════════════════════════════════════════════════════════════

  /**
   * Muestra el mensaje de error de un campo específico.
   * @param {string} idError - ID del span de error
   * @param {string} idInput - ID del input con error
   */
  function _mostrarErrorCampo(idError, idInput) {
    const spanError = document.getElementById(idError);
    const input     = document.getElementById(idInput);
    if (spanError) spanError.style.display = 'flex';
    input?.classList.add('error');
  }

  /**
   * Muestra el banner de error general del formulario.
   * @param {string} mensaje
   */
  function _mostrarErrorBanner(mensaje) {
    const caja = document.getElementById('nivel-error-box');
    const msg  = document.getElementById('nivel-error-msg');
    if (msg)  msg.textContent = mensaje;
    caja?.classList.add('visible');
  }

  /**
   * Escapa HTML para prevenir XSS al insertar texto.
   * @param {string} texto
   * @returns {string}
   */
  function _esc(texto) {
    if (texto == null) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ════════════════════════════════════════════════════════════
  //  ESTILOS ADICIONALES (layout split columnas)
  // ════════════════════════════════════════════════════════════

  /**
   * Inyecta los estilos de layout split una sola vez en el <head>.
   * Se hace aquí para mantener el CSS modular sin modificar los
   * archivos de la Fase 5.
   */
  function _inyectarEstilos() {
    if (document.getElementById('style-modulo-split')) return;

    const style = document.createElement('style');
    style.id = 'style-modulo-split';
    style.textContent = `
      /* ── Layout de dos columnas para módulos CRUD ── */
      .modulo-layout-split {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 1.5rem;
        align-items: start;
      }

      .modulo-col-lista  { min-width: 0; }
      .modulo-col-form   { min-width: 0; }

      /* Ocultar columna de formulario */
      .modulo-col-form.oculta { display: none; }

      /* Cuando el formulario está visible, animar su aparición */
      .modulo-col-form:not(.oculta) {
        animation: slideUp 0.25s ease;
      }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
