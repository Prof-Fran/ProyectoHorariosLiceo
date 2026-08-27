// ============================================================
// modulos/docentes.js — Módulo CRUD de Docentes
// Fase 6: Gestión de docentes y asignación de asignaturas
// Cada docente puede dictar varias asignaturas con grado (1-7)
// y puntaje. La relación se gestiona desde un panel de detalle.
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/formularios.css
// ============================================================

window.Modulo_docentes = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor    = null;  // Elemento raíz
  let _docentes      = [];    // Cache completo de docentes
  let _niveles       = [];    // Cache de niveles (para añadir asignaturas)
  let _asignaturas   = [];    // Cache de asignaturas (select por nivel)
  let _docenteActual = null;  // Docente en el panel de detalle
  let _asignaciones  = [];    // Asignaciones del docente actual
  let _editando      = null;  // null = creando / objeto = editando datos básicos

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_DOC      = () => `${App.API_BASE}/docentes`;
  const URL_NIVI     = () => `${App.API_BASE}/niveles`;
  const URL_ASIG     = () => `${App.API_BASE}/asignaturas`;
  const URL_DA       = () => `${App.API_BASE}/docente_asignatura`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  async function render(contenedor) {
    _contenedor = contenedor;

    _contenedor.innerHTML = `
      <div class="modulo-layout-split" id="doc-layout">

        <!-- ── Columna izquierda: lista de docentes ── -->
        <div class="modulo-col-lista" id="doc-col-lista">

          ${UI.headerModulo(
            'Docentes',
            'Personal docente e inscripción de asignaturas',
            `<button class="btn btn-primary" id="btn-nuevo-doc">
               <i class="fa-solid fa-plus" aria-hidden="true"></i>
               Nuevo docente
             </button>`
          )}

          <div id="doc-tabla-wrap"></div>

        </div>

        <!-- ── Columna derecha: formulario / detalle ── -->
        <div class="modulo-col-form oculta" id="doc-col-form">
          <div id="doc-panel-wrap"></div>
        </div>

      </div>
    `;

    _inyectarEstilos();

    document.getElementById('btn-nuevo-doc')
      ?.addEventListener('click', _abrirFormularioNuevo);

    await _cargarDatos();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  async function _cargarDatos() {
    const wrap = document.getElementById('doc-tabla-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando docentes...');

    try {
      const [rDoc, rNiv, rAsig] = await Promise.all([
        fetch(URL_DOC()),
        fetch(URL_NIVI()),
        fetch(URL_ASIG()),
      ]);
      if (!rDoc.ok || !rNiv.ok || !rAsig.ok) throw new Error('Error al obtener datos');

      _docentes    = await rDoc.json();
      _niveles     = await rNiv.json();
      _asignaturas = await rAsig.json();

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
  //  TABLA DE DOCENTES
  // ════════════════════════════════════════════════════════════

  function _renderizarTabla() {
    const wrap = document.getElementById('doc-tabla-wrap');
    if (!wrap) return;

    UI.renderizarTabla(
      wrap,
      [
        {
          key:   'docente',
          label: 'Docente',
          render: (fila) => `<span style="font-weight:600;color:var(--text)">${_esc(fila.apellido)}, ${_esc(fila.nombre)}</span>`,
        },
        {
          key:   'cedula',
          label: 'Cédula',
          render: (fila) => `<span style="color:var(--text-muted);font-size:var(--text-sm)">${_esc(fila.cedula)}</span>`,
        },
      ],
      _docentes,
      {
        textoVacio: 'No hay docentes registrados. Creá el primero.',
        idVacio:    'fa-solid fa-chalkboard-user',
        acciones: (fila) =>
          UI.btnVer(fila.id, `Ver asignaturas de ${fila.nombre} ${fila.apellido}`) +
          UI.btnEditar(fila.id, `Editar ${fila.nombre} ${fila.apellido}`) +
          UI.btnEliminar(fila.id, `Eliminar ${fila.nombre} ${fila.apellido}`),
      }
    );

    wrap.addEventListener('click', _manejarClickTabla, { once: true });
  }

  function _manejarClickTabla(e) {
    const wrap  = document.getElementById('doc-tabla-wrap');
    const boton = e.target.closest('[data-accion]');

    if (!boton) {
      wrap?.addEventListener('click', _manejarClickTabla, { once: true });
      return;
    }

    const { id, accion } = boton.dataset;
    const docente = _docentes.find(d => d.id === Number(id));

    if (docente) {
      if (accion === 'ver')      _abrirDetalle(docente);
      if (accion === 'editar')   _abrirFormularioEditar(docente);
      if (accion === 'eliminar') _confirmarEliminar(docente);
    }

    wrap?.addEventListener('click', _manejarClickTabla, { once: true });
  }

  // ════════════════════════════════════════════════════════════
  //  FORMULARIO DE DATOS BÁSICOS (crear / editar)
  // ════════════════════════════════════════════════════════════

  function _abrirFormularioNuevo() {
    _editando = null;
    _mostrarFormularioDatos('Nuevo docente', null);
    setTimeout(() => document.getElementById('doc-input-nombre')?.focus(), 80);
  }

  function _abrirFormularioEditar(docente) {
    _editando = docente;
    _mostrarFormularioDatos('Editar docente', docente);
    setTimeout(() => document.getElementById('doc-input-nombre')?.focus(), 80);
  }

  /**
   * Renderiza el formulario de datos básicos en el panel lateral.
   * @param {string} titulo
   * @param {Object|null} docente - Datos para pre-llenar (edición)
   */
  function _mostrarFormularioDatos(titulo, docente) {
    const wrap = document.getElementById('doc-panel-wrap');
    const col  = document.getElementById('doc-col-form');
    if (!wrap || !col) return;

    wrap.innerHTML = `
      <div class="form-panel">

        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo">${_esc(titulo)}</span>
        </div>

        <form id="form-doc" novalidate autocomplete="off">
          <div class="form-panel-body">

            <div class="form-error-box" id="doc-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="doc-error-msg"></span>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="doc-input-nombre">
                Nombre <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-user input-icono-izq" aria-hidden="true"></i>
                <input
                  id="doc-input-nombre"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: María"
                  value="${docente ? _esc(docente.nombre) : ''}"
                  maxlength="100"
                  required
                />
              </div>
              <span class="campo-error" id="doc-error-nombre" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                El nombre es obligatorio.
              </span>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="doc-input-apellido">
                Apellido <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-user input-icono-izq" aria-hidden="true"></i>
                <input
                  id="doc-input-apellido"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: Pérez"
                  value="${docente ? _esc(docente.apellido) : ''}"
                  maxlength="100"
                  required
                />
              </div>
              <span class="campo-error" id="doc-error-apellido" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                El apellido es obligatorio.
              </span>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="doc-input-cedula">
                Cédula <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-id-card input-icono-izq" aria-hidden="true"></i>
                <input
                  id="doc-input-cedula"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: 3.123.456-7"
                  value="${docente ? _esc(docente.cedula) : ''}"
                  maxlength="20"
                  required
                />
              </div>
              <span class="campo-ayuda">Debe ser única. Se usa para identificar al docente.</span>
              <span class="campo-error" id="doc-error-cedula" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                La cédula es obligatoria.
              </span>
            </div>

          </div>

          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="doc-btn-cancelar">Cancelar</button>
            <button type="submit"  class="btn btn-primary"   id="doc-btn-guardar">
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

    document.getElementById('doc-btn-cancelar')
      ?.addEventListener('click', _cerrarPanel, { once: true });

    document.getElementById('form-doc')
      ?.addEventListener('submit', _manejarEnvio, { once: true });

    ['doc-input-nombre', 'doc-input-apellido', 'doc-input-cedula'].forEach(id => {
      document.getElementById(id)?.addEventListener('input',  _ocultarErrores);
      document.getElementById(id)?.addEventListener('change', _ocultarErrores);
    });
  }

  function _cerrarPanel() {
    document.getElementById('doc-col-form')?.classList.add('oculta');
    const wrap = document.getElementById('doc-panel-wrap');
    if (wrap) wrap.innerHTML = '';
    _editando      = null;
    _docenteActual = null;
    _asignaciones  = [];
  }

  function _ocultarErrores() {
    document.getElementById('doc-error-box')?.classList.remove('visible');
    ['doc-error-nombre', 'doc-error-apellido', 'doc-error-cedula'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['doc-input-nombre', 'doc-input-apellido', 'doc-input-cedula'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO DE DATOS BÁSICOS
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvio(e) {
    e.preventDefault();
    _ocultarErrores();

    const nombre   = document.getElementById('doc-input-nombre')?.value.trim()   || '';
    const apellido = document.getElementById('doc-input-apellido')?.value.trim() || '';
    const cedula   = document.getElementById('doc-input-cedula')?.value.trim()   || '';

    let hayError = false;

    if (!nombre)   { _mostrarErrorCampo('doc-error-nombre',   'doc-input-nombre');   hayError = true; }
    if (!apellido) { _mostrarErrorCampo('doc-error-apellido', 'doc-input-apellido'); hayError = true; }
    if (!cedula)   { _mostrarErrorCampo('doc-error-cedula',   'doc-input-cedula');   hayError = true; }

    if (hayError) {
      document.getElementById('form-doc')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
      return;
    }

    const btn = document.getElementById('doc-btn-guardar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      if (_editando) {
        await _actualizar(_editando.id, nombre, apellido, cedula);
      } else {
        await _crear(nombre, apellido, cedula);
      }
    } catch {
      document.getElementById('form-doc')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD (datos básicos)
  // ════════════════════════════════════════════════════════════

  async function _crear(nombre, apellido, cedula) {
    const res   = await fetch(URL_DOC(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, apellido, cedula }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo crear el docente.');
      throw new Error(datos.error);
    }

    _docentes.push(datos);
    _ordenar();
    _renderizarTabla();
    _cerrarPanel();
    UI.mostrarToast(`Docente "${datos.nombre} ${datos.apellido}" creado correctamente.`, 'success');
  }

  async function _actualizar(id, nombre, apellido, cedula) {
    const res   = await fetch(`${URL_DOC()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, apellido, cedula }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo actualizar el docente.');
      throw new Error(datos.error);
    }

    const idx = _docentes.findIndex(d => d.id === id);
    if (idx !== -1) _docentes[idx] = datos;
    _ordenar();
    _renderizarTabla();
    _cerrarPanel();
    UI.mostrarToast(`Docente "${datos.nombre} ${datos.apellido}" actualizado correctamente.`, 'success');
  }

  async function _confirmarEliminar(docente) {
    const etiqueta = `${docente.nombre} ${docente.apellido}`;

    const confirmado = await UI.confirmar(
      'Eliminar docente',
      `¿Estás seguro de que querés eliminar al docente "${etiqueta}"?\n\nEsto eliminará también sus asignaturas asignadas y su disponibilidad. Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );
    if (!confirmado) return;

    try {
      const res   = await fetch(`${URL_DOC()}/${docente.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar el docente.', 'error');
        return;
      }

      _docentes = _docentes.filter(d => d.id !== docente.id);
      _renderizarTabla();
      if (_docenteActual?.id === docente.id) _cerrarPanel();
      UI.mostrarToast(`Docente "${etiqueta}" eliminado.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  PANEL DE DETALLE — Asignación de asignaturas al docente
  // ════════════════════════════════════════════════════════════

  async function _abrirDetalle(docente) {
    _docenteActual = docente;
    const col = document.getElementById('doc-col-form');
    col?.classList.remove('oculta');

    const wrap = document.getElementById('doc-panel-wrap');
    if (!wrap) return;

    // Cabecera de detalle con acciones de editar datos
    wrap.innerHTML = `
      <div class="form-panel">

        <div class="form-panel-header">
          <div class="form-panel-icon" style="background:var(--estado-ocupado-liceo-bg)">
            <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
          </div>
          <div style="display:flex;flex-direction:column;gap:.15rem;min-width:0;">
            <span class="form-panel-titulo" style="white-space:normal;">${_esc(docente.nombre)} ${_esc(docente.apellido)}</span>
            <span style="font-size:var(--text-xs);color:var(--text-muted);">Cédula ${_esc(docente.cedula)}</span>
          </div>
        </div>

        <div class="doc-detalle-acciones">
          <button class="btn btn-secondary btn-sm" id="doc-btn-editar-datos">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
            Editar datos
          </button>
          <button class="btn btn-secondary btn-sm" id="doc-btn-cerrar-panel">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            Cerrar
          </button>
        </div>

        <div class="form-panel-body">

          <div class="doc-seccion-titulo">
            <i class="fa-solid fa-book" aria-hidden="true"></i>
            Asignaturas que puede dictar
          </div>

          <div class="form-error-box" id="doc-error-box" role="alert" aria-live="polite">
            <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
            <span id="doc-error-msg"></span>
          </div>

          <div id="doc-asignaciones-wrap"></div>

          <div class="doc-seccion-titulo" style="margin-top:1rem;">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            Asignar nueva asignatura
          </div>

          <form id="form-doc-asig" novalidate autocomplete="off">
            <div class="campo-grupo">
              <label class="campo-label" for="doc-select-nivel">Nivel <span class="requerido">*</span></label>
              <div class="select-wrapper">
                <i class="fa-solid fa-layer-group input-icono-izq" aria-hidden="true"></i>
                <select id="doc-select-nivel" class="campo-select" required>
                  <option value="">— Seleccioná un nivel —</option>
                </select>
              </div>
              <span class="campo-error" id="doc-error-nivel" style="display:none;">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Seleccioná un nivel.
              </span>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="doc-select-asig">Asignatura <span class="requerido">*</span></label>
              <div class="select-wrapper">
                <i class="fa-solid fa-book input-icono-izq" aria-hidden="true"></i>
                <select id="doc-select-asig" class="campo-select" required>
                  <option value="">— Seleccioná una asignatura —</option>
                </select>
              </div>
              <span class="campo-error" id="doc-error-asig" style="display:none;">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Seleccioná una asignatura.
              </span>
            </div>

            <div class="doc-fila-dos">
              <div class="campo-grupo">
                <label class="campo-label" for="doc-input-grado">Grado (1-7) <span class="requerido">*</span></label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-ranking-star input-icono-izq" aria-hidden="true"></i>
                  <input id="doc-input-grado" type="number" class="campo-input" min="1" max="7" placeholder="Ej: 4" required />
                </div>
                <span class="campo-error" id="doc-error-grado" style="display:none;">
                  <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                  Ingresá un grado entre 1 y 7.
                </span>
              </div>

              <div class="campo-grupo">
                <label class="campo-label" for="doc-input-puntaje">Puntaje <span class="requerido">*</span></label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-star input-icono-izq" aria-hidden="true"></i>
                  <input id="doc-input-puntaje" type="number" step="0.01" min="0" class="campo-input" placeholder="Ej: 114.20" required />
                </div>
                <span class="campo-error" id="doc-error-puntaje" style="display:none;">
                  <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                  Ingresá un puntaje válido (≥ 0).
                </span>
              </div>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="doc-check-efectivo">
                <input type="checkbox" id="doc-check-efectivo" class="campo-checkbox" />
                <span>Efectivo</span>
              </label>
              <span class="campo-ayuda">Marcalo si el docente es efectivo en esta asignatura. Los efectivos se ordenan primero.</span>
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%" id="doc-btn-asig">
              <span class="btn-text">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                Asignar asignatura
              </span>
              <div class="btn-spinner" aria-hidden="true"></div>
            </button>
          </form>

        </div>
      </div>
    `;

    // Poblar el select de niveles
    const selNivel = document.getElementById('doc-select-nivel');
    if (selNivel) {
      selNivel.innerHTML = '<option value="">— Seleccioná un nivel —</option>' +
        _niveles.map(n => `<option value="${n.id}">${_esc(n.nombre)}</option>`).join('');
    }

    document.getElementById('doc-btn-editar-datos')
      ?.addEventListener('click', () => _abrirFormularioEditar(_docenteActual));

    document.getElementById('doc-btn-cerrar-panel')
      ?.addEventListener('click', _cerrarPanel);

    document.getElementById('doc-select-nivel')
      ?.addEventListener('change', _actualizarAsignaturasDeNivel);

    document.getElementById('form-doc-asig')
      ?.addEventListener('submit', _manejarEnvioAsig, { once: true });

    ['doc-select-nivel', 'doc-select-asig', 'doc-input-grado', 'doc-input-puntaje', 'doc-check-efectivo'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _ocultarErroresDetalle);
      document.getElementById(id)?.addEventListener('change', _ocultarErroresDetalle);
    });

    UI.mostrarCargando(document.getElementById('doc-asignaciones-wrap'), 'Cargando asignaturas...');
    await _cargarAsignaciones();
  }

  /** Filtra el select de asignaturas según el nivel elegido. */
  function _actualizarAsignaturasDeNivel() {
    const selNivel = document.getElementById('doc-select-nivel');
    const selAsig  = document.getElementById('doc-select-asig');
    if (!selNivel || !selAsig) return;

    const idNivel = Number(selNivel.value);
    const disponibles = idNivel
      ? _asignaturas.filter(a => a.id_nivel === idNivel)
      : [];

    // Excluir asignaturas ya asignadas a este docente
    const yaAsignadas = new Set(_asignaciones.map(a => a.id_asignatura));

    selAsig.innerHTML = '<option value="">— Seleccioná una asignatura —</option>' +
      disponibles
        .filter(a => !yaAsignadas.has(a.id))
        .map(a => `<option value="${a.id}">${_esc(a.nombre)} (${a.carga_horaria}h)</option>`)
        .join('');

    if (disponibles.filter(a => !yaAsignadas.has(a.id)).length === 0 && idNivel) {
      selAsig.innerHTML = '<option value="">No quedan asignaturas por asignar</option>';
    }
  }

  /** Carga las asignaciones del docente actual y las renderiza. */
  async function _cargarAsignaciones() {
    const wrap = document.getElementById('doc-asignaciones-wrap');
    if (!wrap) return;

    try {
      const res   = await fetch(`${URL_DOC()}/${_docenteActual.id}/asignaturas`);
      if (!res.ok) throw new Error('Error al obtener asignaciones');

      _asignaciones = await res.json();
      _renderizarAsignaciones();
      _actualizarAsignaturasDeNivel();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  /** Renderiza la lista de asignaturas asignadas al docente. */
  function _renderizarAsignaciones() {
    const wrap = document.getElementById('doc-asignaciones-wrap');
    if (!wrap) return;

    if (_asignaciones.length === 0) {
      wrap.innerHTML = `
        <div class="doc-asig-vacio">
          <i class="fa-solid fa-book-open" aria-hidden="true"></i>
          <p>Este docente todavía no tiene asignaturas asignadas.</p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="doc-asig-lista">
        ${_asignaciones.map(da => `
          <div class="doc-asig-item" data-da-id="${da.id}">
            <div class="doc-asig-info">
              <span class="doc-asig-nombre">${_esc(da.asignatura_nombre)}</span>
              <span class="doc-asig-nivel">${_esc(da.nivel_nombre)} · ${da.carga_horaria} hs</span>
            </div>
            <div class="doc-asig-badges">
              ${da.efectivo ? '<span class="badge badge-efectivo">Efectivo</span>' : ''}
              <span class="badge badge-accent">Grado ${da.grado}</span>
              <span class="badge badge-gris">${da.puntaje}</span>
            </div>
            <button class="btn-icono btn-icono-editar doc-asig-editar"
                    data-da-id="${da.id}"
                    data-da-nombre="${_esc(da.asignatura_nombre)}"
                    title="Editar efectivo / grado / puntaje"
                    aria-label="Editar ${_esc(da.asignatura_nombre)}">
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
            </button>
            <button class="btn-icono btn-icono-eliminar doc-asig-eliminar"
                    data-da-id="${da.id}"
                    data-da-nombre="${_esc(da.asignatura_nombre)}"
                    title="Quitar asignatura"
                    aria-label="Quitar asignatura ${_esc(da.asignatura_nombre)}">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;

    wrap.addEventListener('click', _manejarClickAsignaciones, { once: true });
  }

  function _manejarClickAsignaciones(e) {
    const wrap  = document.getElementById('doc-asignaciones-wrap');
    const boton = e.target.closest('[data-da-id]');

    if (!boton) {
      wrap?.addEventListener('click', _manejarClickAsignaciones, { once: true });
      return;
    }

    if (boton.classList.contains('doc-asig-eliminar')) {
      const id     = Number(boton.dataset.daId);
      const nombre = boton.dataset.daNombre;
      _confirmarQuitarAsignatura(id, nombre);
    }

    if (boton.classList.contains('doc-asig-editar')) {
      const id = Number(boton.dataset.daId);
      _abrirEditorAsignacion(id);
    }

    wrap?.addEventListener('click', _manejarClickAsignaciones, { once: true });
  }

  /** Abre un mini-editor para modificar efectivo, grado y puntaje de una asignación. */
  function _abrirEditorAsignacion(idDa) {
    const da = _asignaciones.find(a => a.id === idDa);
    if (!da) return;

    const wrap = document.getElementById('doc-asignaciones-wrap');
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="form-panel" style="box-shadow:none;border:1px solid var(--glass-border);">
        <div class="form-panel-header">
          <div class="form-panel-icon" style="background:var(--estado-ocupado-liceo-bg)">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </div>
          <div style="display:flex;flex-direction:column;gap:.15rem;min-width:0;">
            <span class="form-panel-titulo" style="white-space:normal;">${_esc(da.asignatura_nombre)}</span>
            <span style="font-size:var(--text-xs);color:var(--text-muted);">${_esc(da.nivel_nombre)} · ${da.carga_horaria} hs</span>
          </div>
        </div>

        <div class="form-error-box" id="doc-error-box" role="alert" aria-live="polite">
          <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
          <span id="doc-error-msg"></span>
        </div>

        <div class="form-panel-body" style="padding:1rem;">
          <div class="campo-grupo">
            <label class="campo-label" for="doc-edit-grado">Grado (1-7)</label>
            <input id="doc-edit-grado" type="number" min="1" max="7" class="campo-input" value="${da.grado}" />
          </div>
          <div class="campo-grupo">
            <label class="campo-label" for="doc-edit-puntaje">Puntaje</label>
            <input id="doc-edit-puntaje" type="number" step="0.01" min="0" class="campo-input" value="${da.puntaje}" />
          </div>
          <div class="campo-grupo">
            <label class="campo-label" for="doc-edit-efectivo">
              <input type="checkbox" id="doc-edit-efectivo" class="campo-checkbox" ${da.efectivo ? 'checked' : ''} />
              <span>Efectivo</span>
            </label>
            <span class="campo-ayuda">Los efectivos se ordenan primero.</span>
          </div>
        </div>

        <div class="form-panel-footer">
          <button type="button" class="btn btn-secondary" id="doc-btn-cancelar-edicion">Cancelar</button>
          <button type="button" class="btn btn-primary" id="doc-btn-guardar-edicion">
            <span class="btn-text"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar</span>
            <div class="btn-spinner" aria-hidden="true"></div>
          </button>
        </div>
      </div>
    `;

    const guardar = document.getElementById('doc-btn-guardar-edicion');
    const cancelar = document.getElementById('doc-btn-cancelar-edicion');

    cancelar?.addEventListener('click', () => { _asignaciones = _asignaciones.slice(); _renderizarAsignaciones(); }, { once: true });

    guardar?.addEventListener('click', async () => {
      const grado = Number(document.getElementById('doc-edit-grado')?.value);
      const puntaje = Number(document.getElementById('doc-edit-puntaje')?.value);
      const efectivo = document.getElementById('doc-edit-efectivo')?.checked === true;

      if (!grado || grado < 1 || grado > 7) {
        _mostrarErrorBanner('El grado debe estar entre 1 y 7.');
        return;
      }
      if (document.getElementById('doc-edit-puntaje')?.value === '' || puntaje < 0) {
        _mostrarErrorBanner('Ingresá un puntaje válido (≥ 0).');
        return;
      }

      guardar.classList.add('loading');
      guardar.disabled = true;

      try {
        const res = await fetch(`${URL_DA()}/${idDa}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ grado, puntaje, efectivo }),
        });
        const datos = await res.json();
        if (!res.ok) {
          _mostrarErrorBanner(datos.error || 'No se pudo actualizar la asignación.');
          return;
        }
        Object.assign(da, datos);
        _renderizarAsignaciones();
        UI.mostrarToast('Asignación actualizada correctamente.', 'success');
      } catch {
        _mostrarErrorBanner('No se pudo conectar con el servidor.');
      } finally {
        guardar.classList.remove('loading');
        guardar.disabled = false;
      }
    });
  }

  /** Quita una asignación de asignatura del docente. */
  async function _confirmarQuitarAsignatura(idDa, nombreAsignatura) {
    const confirmado = await UI.confirmar(
      'Quitar asignatura',
      `¿Querés quitar "${nombreAsignatura}" de este docente? Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Quitar', variante: 'danger' }
    );
    if (!confirmado) return;

    try {
      const res   = await fetch(`${URL_DA()}/${idDa}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo quitar la asignatura.', 'error');
        return;
      }

      _asignaciones = _asignaciones.filter(a => a.id !== idDa);
      _renderizarAsignaciones();
      _actualizarAsignaturasDeNivel();
      UI.mostrarToast(`Asignatura "${nombreAsignatura}" quitada.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO DE ASIGNACIÓN
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvioAsig(e) {
    e.preventDefault();
    _ocultarErroresDetalle();

    const idAsignatura = Number(document.getElementById('doc-select-asig')?.value) || 0;
    const grado        = Number(document.getElementById('doc-input-grado')?.value)  || 0;
    const puntaje      = Number(document.getElementById('doc-input-puntaje')?.value);
    const efectivo     = document.getElementById('doc-check-efectivo')?.checked === true;
    const puntajeValido = document.getElementById('doc-input-puntaje')?.value !== '' && puntaje >= 0;

    let hayError = false;

    if (!idAsignatura) { _mostrarErrorCampo('doc-error-asig', 'doc-select-asig'); hayError = true; }
    if (!grado || grado < 1 || grado > 7) {
      _mostrarErrorCampo('doc-error-grado', 'doc-input-grado'); hayError = true;
    }
    if (!puntajeValido) {
      _mostrarErrorCampo('doc-error-puntaje', 'doc-input-puntaje'); hayError = true;
    }

    if (hayError) {
      document.getElementById('form-doc-asig')
        ?.addEventListener('submit', _manejarEnvioAsig, { once: true });
      return;
    }

    const btn = document.getElementById('doc-btn-asig');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      const res   = await fetch(URL_DA(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id_docente:   _docenteActual.id,
          id_asignatura: idAsignatura,
          grado,
          puntaje,
          efectivo,
        }),
      });
      const datos = await res.json();

      if (!res.ok) {
        _mostrarErrorBanner(datos.error || 'No se pudo asignar la asignatura.');
        throw new Error(datos.error);
      }

      // Limpiar el formulario
      ['doc-select-nivel', 'doc-select-asig', 'doc-input-grado', 'doc-input-puntaje'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const chk = document.getElementById('doc-check-efectivo');
      if (chk) chk.checked = false;

      // Recargar asignaciones (para obtener nombres y orden)
      await _cargarAsignaciones();
      UI.mostrarToast('Asignatura asignada correctamente.', 'success');
    } catch {
      document.getElementById('form-doc-asig')
        ?.addEventListener('submit', _manejarEnvioAsig, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

  /** Ordena docentes por apellido y nombre. */
  function _ordenar() {
    _docentes.sort((a, b) => {
      const cmp = (a.apellido || '').localeCompare(b.apellido || '', 'es');
      return cmp !== 0 ? cmp : (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
  }

  function _mostrarErrorCampo(idError, idInput) {
    const span = document.getElementById(idError);
    const el   = document.getElementById(idInput);
    if (span) span.style.display = 'flex';
    el?.classList.add('error');
  }

  function _mostrarErrorBanner(mensaje) {
    const caja = document.getElementById('doc-error-box');
    const msg  = document.getElementById('doc-error-msg');
    if (msg)  msg.textContent = mensaje;
    caja?.classList.add('visible');
  }

  function _ocultarErroresDetalle() {
    document.getElementById('doc-error-box')?.classList.remove('visible');
    ['doc-error-nivel', 'doc-error-asig', 'doc-error-grado', 'doc-error-puntaje'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['doc-select-nivel', 'doc-select-asig', 'doc-input-grado', 'doc-input-puntaje', 'doc-check-efectivo'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });
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

    if (document.getElementById('style-modulo-docentes')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-docentes';
    style.textContent = `
      .doc-detalle-acciones {
        display: flex;
        gap: 0.5rem;
        padding: 0 1rem 0.75rem;
        border-bottom: 1px solid var(--glass-border);
        background: rgba(255,255,255,0.01);
      }
      .btn-sm { padding: 0.4rem 0.75rem; font-size: var(--text-sm); }

      .doc-seccion-titulo {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text);
        margin-bottom: 0.75rem;
      }

      .doc-fila-dos {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .doc-asig-vacio {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.5rem;
        border: 1px dashed var(--glass-border-h);
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        font-size: var(--text-sm);
        text-align: center;
      }
      .doc-asig-vacio i { font-size: 1.4rem; color: var(--estado-vacio-bdr); }

      .doc-asig-lista {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
        padding-right: 0.15rem;
      }

      .doc-asig-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0.7rem;
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-sm);
      }

      .doc-asig-info {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
        flex: 1;
      }
      .doc-asig-nombre {
        font-weight: 600;
        color: var(--text);
        font-size: var(--text-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .doc-asig-nivel {
        font-size: var(--text-xs);
        color: var(--text-muted);
      }

      .doc-asig-badges {
        display: flex;
        gap: 0.3rem;
        flex-shrink: 0;
      }
      .doc-asig-badges .badge { font-size: var(--text-xs); padding: 0.2rem 0.5rem; }

      .doc-asig-eliminar { flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
