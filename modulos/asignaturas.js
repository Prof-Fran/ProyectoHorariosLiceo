// ============================================================
// modulos/asignaturas.js — Módulo CRUD de Asignaturas
// Fase 6: Gestión de asignaturas por nivel
// Cada asignatura pertenece a un nivel y tiene una carga horaria.
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/formularios.css
// ============================================================

window.Modulo_asignaturas = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor        = null;  // Elemento raíz
  let _asignaturas       = [];    // Cache completo de asignaturas
  let _asignaturasFiltro = [];    // Asignaturas del nivel seleccionado
  let _niveles           = [];    // Cache de niveles (selector de filtro y formulario)
  let _nivelFiltro       = null;  // ID del nivel actualmente seleccionado (null = todos)
  let _editando          = null;  // null = creando / objeto = editando

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_ASIG   = () => `${App.API_BASE}/asignaturas`;
  const URL_NIVI   = () => `${App.API_BASE}/niveles`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  async function render(contenedor) {
    _contenedor = contenedor;

    _contenedor.innerHTML = `
      <div class="modulo-layout-split" id="asig-layout">

        <!-- ── Columna izquierda: lista ── -->
        <div class="modulo-col-lista" id="asig-col-lista">

          ${UI.headerModulo(
            'Asignaturas',
            'Materias disponibles por nivel educativo',
            `<button class="btn btn-primary" id="btn-nueva-asig">
               <i class="fa-solid fa-plus" aria-hidden="true"></i>
               Nueva asignatura
             </button>`
          )}

          <!-- Filtro por nivel -->
          <div class="asig-filtro-wrap" id="asig-filtro-wrap"></div>

          <!-- Tabla / vacío -->
          <div id="asig-tabla-wrap"></div>

        </div>

        <!-- ── Columna derecha: formulario ── -->
        <div class="modulo-col-form oculta" id="asig-col-form">
          <div id="asig-form-wrap"></div>
        </div>

      </div>
    `;

    _inyectarEstilos();

    document.getElementById('btn-nueva-asig')
      ?.addEventListener('click', _abrirFormularioNuevo);

    await _cargarDatos();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  async function _cargarDatos() {
    const wrap = document.getElementById('asig-tabla-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando asignaturas...');

    try {
      const [rAsig, rNiv] = await Promise.all([
        fetch(URL_ASIG()),
        fetch(URL_NIVI()),
      ]);
      if (!rAsig.ok || !rNiv.ok) throw new Error('Error al obtener datos');

      _asignaturas = await rAsig.json();
      _niveles     = await rNiv.json();

      _renderizarFiltro();
      _aplicarFiltro();
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
  //  FILTRO POR NIVEL (tabs horizontales)
  // ════════════════════════════════════════════════════════════

  function _renderizarFiltro() {
    const wrap = document.getElementById('asig-filtro-wrap');
    if (!wrap) return;

    if (_niveles.length === 0) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <div class="asig-filtro" role="tablist" aria-label="Filtrar asignaturas por nivel">
        <button
          class="asig-filtro-tab ${_nivelFiltro === null ? 'activo' : ''}"
          data-nivel-id="todos"
          role="tab"
          aria-selected="${_nivelFiltro === null}"
        >
          Todos
        </button>
        ${_niveles.map(n => `
          <button
            class="asig-filtro-tab ${_nivelFiltro === n.id ? 'activo' : ''}"
            data-nivel-id="${n.id}"
            role="tab"
            aria-selected="${_nivelFiltro === n.id}"
          >
            ${_esc(n.nombre)}
          </button>
        `).join('')}
      </div>
    `;

    // Delegación de clics en las tabs
    wrap.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-nivel-id]');
      if (!tab) return;
      const val = tab.dataset.nivelId;
      _nivelFiltro = val === 'todos' ? null : Number(val);
      _renderizarFiltro();
      _aplicarFiltro();
    });
  }

  /** Filtra el cache de asignaturas y actualiza la tabla. */
  function _aplicarFiltro() {
    _asignaturasFiltro = _nivelFiltro === null
      ? [..._asignaturas]
      : _asignaturas.filter(a => a.id_nivel === _nivelFiltro);

    _renderizarTabla();
  }

  // ════════════════════════════════════════════════════════════
  //  TABLA
  // ════════════════════════════════════════════════════════════

  function _renderizarTabla() {
    const wrap = document.getElementById('asig-tabla-wrap');
    if (!wrap) return;

    UI.renderizarTabla(
      wrap,
      [
        {
          key:   'nombre',
          label: 'Asignatura',
          render: (fila) => `<span style="font-weight:600;color:var(--text)">${_esc(fila.nombre)}</span>`,
        },
        {
          key:   'nivel_nombre',
          label: 'Nivel',
          render: (fila) => UI.badge('neutral', fila.nivel_nombre, 'fa-solid fa-layer-group'),
        },
        {
          key:   'carga_horaria',
          label: 'Carga horaria',
          render: (fila) => `
            <div class="asig-carga-wrap">
              ${UI.barraProgreso(0, fila.carga_horaria)}
              <span class="asig-carga-num">${fila.carga_horaria}h</span>
            </div>
          `,
        },
      ],
      _asignaturasFiltro,
      {
        textoVacio: _nivelFiltro
          ? 'No hay asignaturas en este nivel. Podés crear una con el botón superior.'
          : 'No hay asignaturas registradas. Creá la primera.',
        idVacio: 'fa-solid fa-book',
        acciones: (fila) =>
          UI.btnEditar(fila.id, `Editar ${fila.nombre}`) +
          UI.btnEliminar(fila.id, `Eliminar ${fila.nombre}`),
      }
    );

    wrap.addEventListener('click', _manejarClickTabla, { once: true });
  }

  function _manejarClickTabla(e) {
    const wrap  = document.getElementById('asig-tabla-wrap');
    const boton = e.target.closest('[data-accion]');

    if (!boton) {
      wrap?.addEventListener('click', _manejarClickTabla, { once: true });
      return;
    }

    const { id, accion } = boton.dataset;
    const asig = _asignaturas.find(a => a.id === Number(id));

    if (asig) {
      if (accion === 'editar')   _abrirFormularioEditar(asig);
      if (accion === 'eliminar') _confirmarEliminar(asig);
    }

    wrap?.addEventListener('click', _manejarClickTabla, { once: true });
  }

  // ════════════════════════════════════════════════════════════
  //  FORMULARIO
  // ════════════════════════════════════════════════════════════

  function _abrirFormularioNuevo() {
    _editando = null;
    // Pre-seleccionar el nivel del filtro activo si lo hay
    _mostrarFormulario('Nueva asignatura', null, _nivelFiltro);
    setTimeout(() => document.getElementById('asig-input-nombre')?.focus(), 80);
  }

  function _abrirFormularioEditar(asig) {
    _editando = asig;
    _mostrarFormulario('Editar asignatura', asig, asig.id_nivel);
    setTimeout(() => document.getElementById('asig-input-nombre')?.focus(), 80);
  }

  /**
   * Renderiza el formulario en el panel lateral.
   * @param {string} titulo
   * @param {Object|null} asig  - Datos para pre-llenar (edición)
   * @param {number|null} nivelPresel - ID del nivel a pre-seleccionar
   */
  function _mostrarFormulario(titulo, asig, nivelPresel) {
    const wrap = document.getElementById('asig-form-wrap');
    const col  = document.getElementById('asig-col-form');
    if (!wrap || !col) return;

    const opcionesNivel = _niveles.length > 0
      ? _niveles.map(n => `
          <option value="${n.id}" ${nivelPresel === n.id ? 'selected' : ''}>
            ${_esc(n.nombre)}
          </option>
        `).join('')
      : '<option value="" disabled>No hay niveles creados</option>';

    wrap.innerHTML = `
      <div class="form-panel">

        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-solid fa-book" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo">${_esc(titulo)}</span>
        </div>

        <form id="form-asig" novalidate autocomplete="off">
          <div class="form-panel-body">

            <!-- Error general -->
            <div class="form-error-box" id="asig-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="asig-error-msg"></span>
            </div>

            <!-- Nombre -->
            <div class="campo-grupo">
              <label class="campo-label" for="asig-input-nombre">
                Nombre <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-book input-icono-izq" aria-hidden="true"></i>
                <input
                  id="asig-input-nombre"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: Matemática, Lengua, Informática..."
                  value="${asig ? _esc(asig.nombre) : ''}"
                  maxlength="100"
                  required
                />
              </div>
              <span class="campo-error" id="asig-error-nombre" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                El nombre es obligatorio.
              </span>
            </div>

            <!-- Nivel -->
            <div class="campo-grupo">
              <label class="campo-label" for="asig-select-nivel">
                Nivel <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="select-wrapper">
                <i class="fa-solid fa-layer-group input-icono-izq" aria-hidden="true"></i>
                <select id="asig-select-nivel" class="campo-select" required ${asig ? 'disabled style="opacity:.55;cursor:not-allowed;"' : ''}>
                  <option value="">— Seleccioná un nivel —</option>
                  ${opcionesNivel}
                </select>
              </div>
              ${asig
                ? '<span class="campo-ayuda">El nivel no se puede cambiar una vez creada la asignatura.</span>'
                : '<span class="campo-ayuda">La carga horaria puede variar entre niveles, por eso cada asignatura está vinculada a uno solo.</span>'
              }
              <span class="campo-error" id="asig-error-nivel" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Seleccioná un nivel.
              </span>
            </div>

            <!-- Carga horaria -->
            <div class="campo-grupo">
              <label class="campo-label" for="asig-input-carga">
                Carga horaria (horas semanales) <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-regular fa-clock input-icono-izq" aria-hidden="true"></i>
                <input
                  id="asig-input-carga"
                  type="number"
                  class="campo-input"
                  placeholder="Ej: 3"
                  value="${asig ? _esc(String(asig.carga_horaria)) : ''}"
                  min="1"
                  max="40"
                  required
                />
              </div>
              <span class="campo-ayuda">
                Cantidad de horas semanales que ocupa esta asignatura en el horario del grupo.
              </span>
              <span class="campo-error" id="asig-error-carga" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Ingresá una carga horaria válida (mínimo 1 hora).
              </span>
            </div>

          </div>

          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="asig-btn-cancelar">Cancelar</button>
            <button type="submit"  class="btn btn-primary"   id="asig-btn-guardar">
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

    col.classList.remove('oculta');

    document.getElementById('asig-btn-cancelar')
      ?.addEventListener('click', _cerrarFormulario, { once: true });

    document.getElementById('form-asig')
      ?.addEventListener('submit', _manejarEnvio, { once: true });

    // Limpiar errores al escribir
    ['asig-input-nombre', 'asig-select-nivel', 'asig-input-carga'].forEach(id => {
      document.getElementById(id)?.addEventListener('input',  _ocultarErrores);
      document.getElementById(id)?.addEventListener('change', _ocultarErrores);
    });
  }

  function _cerrarFormulario() {
    document.getElementById('asig-col-form')?.classList.add('oculta');
    const wrap = document.getElementById('asig-form-wrap');
    if (wrap) wrap.innerHTML = '';
    _editando = null;
  }

  function _ocultarErrores() {
    document.getElementById('asig-error-box')?.classList.remove('visible');
    ['asig-error-nombre', 'asig-error-nivel', 'asig-error-carga'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['asig-input-nombre', 'asig-select-nivel', 'asig-input-carga'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvio(e) {
    e.preventDefault();
    _ocultarErrores();

    const nombre  = document.getElementById('asig-input-nombre')?.value.trim() || '';
    const idNivel = _editando
      ? _editando.id_nivel  // en edición el nivel no cambia
      : (Number(document.getElementById('asig-select-nivel')?.value) || 0);
    const carga   = Number(document.getElementById('asig-input-carga')?.value) || 0;

    let hayError = false;

    if (!nombre) {
      _mostrarErrorCampo('asig-error-nombre', 'asig-input-nombre');
      hayError = true;
    }
    if (!idNivel) {
      _mostrarErrorCampo('asig-error-nivel', 'asig-select-nivel');
      hayError = true;
    }
    if (!carga || carga < 1) {
      _mostrarErrorCampo('asig-error-carga', 'asig-input-carga');
      hayError = true;
    }

    if (hayError) {
      document.getElementById('form-asig')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
      return;
    }

    const btn = document.getElementById('asig-btn-guardar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      if (_editando) {
        await _actualizar(_editando.id, nombre, idNivel, carga);
      } else {
        await _crear(nombre, idNivel, carga);
      }
    } catch {
      document.getElementById('form-asig')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD
  // ════════════════════════════════════════════════════════════

  async function _crear(nombre, idNivel, cargaHoraria) {
    const res   = await fetch(URL_ASIG(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, id_nivel: idNivel, carga_horaria: cargaHoraria }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo crear la asignatura.');
      throw new Error(datos.error);
    }

    // Completar nombre del nivel desde el cache local
    datos.nivel_nombre = _niveles.find(n => n.id === idNivel)?.nombre || '';

    _asignaturas.push(datos);
    _ordenar();
    _aplicarFiltro();
    _cerrarFormulario();
    UI.mostrarToast(`Asignatura "${datos.nombre}" creada correctamente.`, 'success');
  }

  async function _actualizar(id, nombre, idNivel, cargaHoraria) {
    const res   = await fetch(`${URL_ASIG()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, id_nivel: idNivel, carga_horaria: cargaHoraria }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo actualizar la asignatura.');
      throw new Error(datos.error);
    }

    datos.nivel_nombre = _niveles.find(n => n.id === idNivel)?.nombre || '';

    const idx = _asignaturas.findIndex(a => a.id === id);
    if (idx !== -1) _asignaturas[idx] = datos;
    _ordenar();
    _aplicarFiltro();
    _cerrarFormulario();
    UI.mostrarToast(`Asignatura "${datos.nombre}" actualizada correctamente.`, 'success');
  }

  async function _confirmarEliminar(asig) {
    const confirmado = await UI.confirmar(
      'Eliminar asignatura',
      `¿Estás seguro de que querés eliminar "${asig.nombre}" (${asig.nivel_nombre})?\n\nEsto eliminará también las asignaciones de docentes que la dicten en grupos. Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );
    if (!confirmado) return;

    try {
      const res   = await fetch(`${URL_ASIG()}/${asig.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar.', 'error');
        return;
      }

      _asignaturas = _asignaturas.filter(a => a.id !== asig.id);
      _aplicarFiltro();
      if (_editando?.id === asig.id) _cerrarFormulario();
      UI.mostrarToast(`Asignatura "${asig.nombre}" eliminada.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

  function _ordenar() {
    _asignaturas.sort((a, b) => {
      const cmpNivel = (a.nivel_nombre || '').localeCompare(b.nivel_nombre || '', 'es');
      return cmpNivel !== 0 ? cmpNivel : (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
  }

  function _mostrarErrorCampo(idError, idInput) {
    const span = document.getElementById(idError);
    const el   = document.getElementById(idInput);
    if (span) span.style.display = 'flex';
    el?.classList.add('error');
  }

  function _mostrarErrorBanner(mensaje) {
    const caja = document.getElementById('asig-error-box');
    const msg  = document.getElementById('asig-error-msg');
    if (msg)  msg.textContent = mensaje;
    caja?.classList.add('visible');
  }

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
  //  ESTILOS DEL MÓDULO
  // ════════════════════════════════════════════════════════════

  function _inyectarEstilos() {
    // Layout split compartido
    if (!document.getElementById('style-modulo-split')) {
      const s = document.createElement('style');
      s.id = 'style-modulo-split';
      s.textContent = `
        .modulo-layout-split {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 1.5rem;
          align-items: start;
        }
        .modulo-col-lista  { min-width: 0; }
        .modulo-col-form   { min-width: 0; }
        .modulo-col-form.oculta { display: none; }
        .modulo-col-form:not(.oculta) { animation: slideUp 0.25s ease; }
      `;
      document.head.appendChild(s);
    }

    if (document.getElementById('style-modulo-asignaturas')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-asignaturas';
    style.textContent = `
      /* ── Filtro de niveles (tabs) ── */
      .asig-filtro-wrap {
        margin-bottom: 1rem;
      }

      .asig-filtro {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.5rem;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
      }

      .asig-filtro-tab {
        padding: 0.35rem 0.85rem;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-muted);
        font-size: var(--text-sm);
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: background var(--transition), color var(--transition), border-color var(--transition);
        white-space: nowrap;
      }

      .asig-filtro-tab:hover {
        background: rgba(255,255,255,0.05);
        color: var(--text);
      }

      .asig-filtro-tab.activo {
        background: var(--accent-subtle);
        border-color: var(--accent-border);
        color: var(--accent-hover);
        font-weight: 700;
      }

      /* ── Carga horaria en la tabla ── */
      .asig-carga-wrap {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-width: 120px;
      }

      .asig-carga-num {
        font-size: var(--text-xs);
        font-weight: 700;
        color: var(--text-muted);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
