// ============================================================
// modulos/grupos.js — Módulo CRUD de Grupos
// Fase 6: Gestión de grupos (nivel + turno + número)
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/formularios.css
// ============================================================

window.Modulo_grupos = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor   = null;  // Elemento raíz donde se renderiza
  let _grupos       = [];    // Cache de grupos cargados
  let _niveles      = [];    // Cache de niveles (para el select)
  let _turnos       = [];    // Cache de turnos (para el select)
  let _grupoEditando = null; // null = creando / objeto = editando

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_GRUPOS  = () => `${App.API_BASE}/grupos`;
  const URL_NIVELES = () => `${App.API_BASE}/niveles`;
  const URL_TURNOS  = () => `${App.API_BASE}/turnos`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  /**
   * Punto de entrada: renderiza el módulo en el contenedor dado.
   * @param {HTMLElement} contenedor
   */
  async function render(contenedor) {
    _contenedor = contenedor;

    _contenedor.innerHTML = `
      <div class="modulo-layout-split" id="grupos-layout">

        <!-- ── Columna izquierda: lista ── -->
        <div class="modulo-col-lista" id="grupos-col-lista">

          ${UI.headerModulo(
            'Grupos',
            'Grupos de alumnos por nivel y turno',
            `<button class="btn btn-primary" id="btn-nuevo-grupo">
               <i class="fa-solid fa-plus" aria-hidden="true"></i>
               Nuevo grupo
             </button>`
          )}

          <div id="grupos-tabla-wrap"></div>

        </div>

        <!-- ── Columna derecha: formulario ── -->
        <div class="modulo-col-form oculta" id="grupos-col-form">
          <div id="grupos-form-wrap"></div>
        </div>

      </div>
    `;

    _inyectarEstilos();

    document.getElementById('btn-nuevo-grupo')
      ?.addEventListener('click', _abrirFormularioNuevo);

    // Cargar niveles, turnos y grupos en paralelo
    await _cargarDatos();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  async function _cargarDatos() {
    const wrap = document.getElementById('grupos-tabla-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando grupos...');

    try {
      const [rGrupos, rNiveles, rTurnos] = await Promise.all([
        fetch(URL_GRUPOS()),
        fetch(URL_NIVELES()),
        fetch(URL_TURNOS()),
      ]);

      if (!rGrupos.ok || !rNiveles.ok || !rTurnos.ok) {
        throw new Error('Error al obtener datos');
      }

      _grupos  = await rGrupos.json();
      _niveles = await rNiveles.json();
      _turnos  = await rTurnos.json();

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
  //  TABLA DE GRUPOS
  // ════════════════════════════════════════════════════════════

  function _renderizarTabla() {
    const wrap = document.getElementById('grupos-tabla-wrap');
    if (!wrap) return;

    UI.renderizarTabla(
      wrap,
      [
        {
          key:   'grupo',
          label: 'Grupo',
          render: (fila) => `
            <span class="grupo-chip">
              <span class="grupo-chip-nivel">${_esc(fila.nivel_nombre)}</span><span class="grupo-chip-num">${_esc(String(fila.numero))}</span>
            </span>
          `,
        },
        {
          key:   'nivel_nombre',
          label: 'Nivel',
          render: (fila) => `<span style="color:var(--text-muted);font-size:var(--text-sm)">${_esc(fila.nivel_nombre)}</span>`,
        },
        {
          key:   'turno_nombre',
          label: 'Turno',
          render: (fila) => UI.badge('info', fila.turno_nombre, 'fa-solid fa-clock'),
        },
      ],
      _grupos,
      {
        textoVacio: 'No hay grupos registrados. Creá el primero.',
        idVacio:    'fa-solid fa-users',
        acciones: (fila) =>
          UI.btnEditar(fila.id, `Editar grupo ${fila.nivel_nombre}${fila.numero}`) +
          UI.btnEliminar(fila.id, `Eliminar grupo ${fila.nivel_nombre}${fila.numero}`),
      }
    );

    wrap.addEventListener('click', _manejarClickTabla, { once: true });
  }

  function _manejarClickTabla(e) {
    const wrap  = document.getElementById('grupos-tabla-wrap');
    const boton = e.target.closest('[data-accion]');

    if (!boton) {
      wrap?.addEventListener('click', _manejarClickTabla, { once: true });
      return;
    }

    const { id, accion } = boton.dataset;
    const grupoId = Number(id);
    const grupo   = _grupos.find(g => g.id === grupoId);

    if (grupo) {
      if (accion === 'editar')   _abrirFormularioEditar(grupo);
      if (accion === 'eliminar') _confirmarEliminar(grupo);
    }

    wrap?.addEventListener('click', _manejarClickTabla, { once: true });
  }

  // ════════════════════════════════════════════════════════════
  //  FORMULARIO
  // ════════════════════════════════════════════════════════════

  function _abrirFormularioNuevo() {
    _grupoEditando = null;
    _mostrarFormulario('Nuevo grupo', null);
    setTimeout(() => document.getElementById('grupo-select-nivel')?.focus(), 80);
  }

  function _abrirFormularioEditar(grupo) {
    _grupoEditando = grupo;
    _mostrarFormulario('Editar grupo', grupo);
    setTimeout(() => document.getElementById('grupo-select-nivel')?.focus(), 80);
  }

  /**
   * Genera el HTML del formulario y lo inyecta en el panel lateral.
   * @param {string} titulo
   * @param {Object|null} grupo - Datos para pre-llenar en edición
   */
  function _mostrarFormulario(titulo, grupo) {
    const wrap = document.getElementById('grupos-form-wrap');
    const col  = document.getElementById('grupos-col-form');
    if (!wrap || !col) return;

    // Opciones de nivel para el select
    const opcionesNivel = _niveles.length > 0
      ? _niveles.map(n => `
          <option value="${n.id}" ${grupo?.id_nivel === n.id ? 'selected' : ''}>
            ${_esc(n.nombre)}
          </option>
        `).join('')
      : '<option value="" disabled>No hay niveles creados</option>';

    // Opciones de turno para el select
    const opcionesTurno = _turnos.length > 0
      ? _turnos.map(t => `
          <option value="${t.id}" ${grupo?.id_turno === t.id ? 'selected' : ''}>
            ${_esc(t.nombre)}
          </option>
        `).join('')
      : '<option value="" disabled>No hay turnos creados</option>';

    wrap.innerHTML = `
      <div class="form-panel">

        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-solid fa-users" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo">${_esc(titulo)}</span>
        </div>

        <form id="form-grupo" novalidate autocomplete="off">
          <div class="form-panel-body">

            <!-- Error general -->
            <div class="form-error-box" id="grupo-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="grupo-error-msg"></span>
            </div>

            <!-- Nivel -->
            <div class="campo-grupo">
              <label class="campo-label" for="grupo-select-nivel">
                Nivel <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="select-wrapper">
                <i class="fa-solid fa-layer-group input-icono-izq" aria-hidden="true"></i>
                <select id="grupo-select-nivel" class="campo-select" required>
                  <option value="">— Seleccioná un nivel —</option>
                  ${opcionesNivel}
                </select>
              </div>
              <span class="campo-error" id="grupo-error-nivel" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Seleccioná un nivel.
              </span>
            </div>

            <!-- Turno -->
            <div class="campo-grupo">
              <label class="campo-label" for="grupo-select-turno">
                Turno <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="select-wrapper">
                <i class="fa-solid fa-clock input-icono-izq" aria-hidden="true"></i>
                <select id="grupo-select-turno" class="campo-select" required>
                  <option value="">— Seleccioná un turno —</option>
                  ${opcionesTurno}
                </select>
              </div>
              <span class="campo-error" id="grupo-error-turno" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Seleccioná un turno.
              </span>
            </div>

            <!-- Número de grupo -->
            <div class="campo-grupo">
              <label class="campo-label" for="grupo-input-numero">
                Número de grupo <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-hashtag input-icono-izq" aria-hidden="true"></i>
                <input
                  id="grupo-input-numero"
                  type="number"
                  class="campo-input"
                  placeholder="Ej: 1, 2, 3..."
                  value="${grupo ? _esc(String(grupo.numero)) : ''}"
                  min="1"
                  max="99"
                  required
                />
              </div>
              <span class="campo-ayuda">
                El número identifica el grupo dentro del nivel y turno.
                Ejemplo: Nivel 7°, Turno Matutino, Número 1 → <strong>7°1</strong>
              </span>
              <span class="campo-error" id="grupo-error-numero" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Ingresá un número de grupo válido (mayor a 0).
              </span>
            </div>

            <!-- Vista previa del nombre -->
            <div class="grupo-preview" id="grupo-preview" style="display:none">
              <span class="grupo-preview-label">Vista previa:</span>
              <span class="grupo-chip">
                <span class="grupo-chip-nivel" id="preview-nivel">—</span><span class="grupo-chip-num" id="preview-num">—</span>
              </span>
              <span class="grupo-preview-turno" id="preview-turno"></span>
            </div>

          </div>

          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="grupo-btn-cancelar">Cancelar</button>
            <button type="submit"  class="btn btn-primary"   id="grupo-btn-guardar">
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

    // Eventos
    document.getElementById('grupo-btn-cancelar')
      ?.addEventListener('click', _cerrarFormulario, { once: true });

    document.getElementById('form-grupo')
      ?.addEventListener('submit', _manejarEnvio, { once: true });

    // Vista previa dinámica al cambiar nivel / turno / número
    ['grupo-select-nivel', 'grupo-select-turno', 'grupo-input-numero'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _actualizarPreview);
      document.getElementById(id)?.addEventListener('change', _actualizarPreview);
    });

    // Limpiar errores al cambiar
    ['grupo-select-nivel', 'grupo-select-turno', 'grupo-input-numero'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', _ocultarErrores);
      document.getElementById(id)?.addEventListener('input',  _ocultarErrores);
    });

    // Si hay datos pre-llenados, mostrar preview inicial
    if (grupo) _actualizarPreview();
  }

  /** Actualiza la vista previa del nombre del grupo mientras el usuario selecciona. */
  function _actualizarPreview() {
    const idNivel  = Number(document.getElementById('grupo-select-nivel')?.value);
    const idTurno  = Number(document.getElementById('grupo-select-turno')?.value);
    const numero   = document.getElementById('grupo-input-numero')?.value?.trim();
    const preview  = document.getElementById('grupo-preview');

    const nivel = _niveles.find(n => n.id === idNivel);
    const turno = _turnos.find(t => t.id === idTurno);

    if ((nivel || turno || numero) && preview) {
      preview.style.display = 'flex';
      document.getElementById('preview-nivel').textContent = nivel?.nombre || '?';
      document.getElementById('preview-num').textContent   = numero || '?';
      document.getElementById('preview-turno').textContent = turno ? `· ${turno.nombre}` : '';
    } else if (preview) {
      preview.style.display = 'none';
    }
  }

  function _cerrarFormulario() {
    document.getElementById('grupos-col-form')?.classList.add('oculta');
    const wrap = document.getElementById('grupos-form-wrap');
    if (wrap) wrap.innerHTML = '';
    _grupoEditando = null;
  }

  function _ocultarErrores() {
    document.getElementById('grupo-error-box')?.classList.remove('visible');
    ['grupo-error-nivel', 'grupo-error-turno', 'grupo-error-numero'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['grupo-select-nivel', 'grupo-select-turno', 'grupo-input-numero'].forEach(id => {
      document.getElementById(id)?.classList.remove('error');
    });
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvio(e) {
    e.preventDefault();
    _ocultarErrores();

    const idNivel = Number(document.getElementById('grupo-select-nivel')?.value) || 0;
    const idTurno = Number(document.getElementById('grupo-select-turno')?.value) || 0;
    const numero  = Number(document.getElementById('grupo-input-numero')?.value)  || 0;

    // Validaciones cliente
    let hayError = false;

    if (!idNivel) {
      _mostrarErrorCampo('grupo-error-nivel', 'grupo-select-nivel');
      hayError = true;
    }
    if (!idTurno) {
      _mostrarErrorCampo('grupo-error-turno', 'grupo-select-turno');
      hayError = true;
    }
    if (!numero || numero < 1) {
      _mostrarErrorCampo('grupo-error-numero', 'grupo-input-numero');
      hayError = true;
    }

    if (hayError) {
      document.getElementById('form-grupo')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
      return;
    }

    const btn = document.getElementById('grupo-btn-guardar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      if (_grupoEditando) {
        await _actualizarGrupo(_grupoEditando.id, idNivel, idTurno, numero);
      } else {
        await _crearGrupo(idNivel, idTurno, numero);
      }
    } catch {
      document.getElementById('form-grupo')
        ?.addEventListener('submit', _manejarEnvio, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD
  // ════════════════════════════════════════════════════════════

  async function _crearGrupo(idNivel, idTurno, numero) {
    const res   = await fetch(URL_GRUPOS(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_nivel: idNivel, id_turno: idTurno, numero }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo crear el grupo.');
      throw new Error(datos.error);
    }

    // El endpoint devuelve el registro sin los nombres; los completamos localmente
    datos.nivel_nombre = _niveles.find(n => n.id === idNivel)?.nombre || '';
    datos.turno_nombre = _turnos.find(t => t.id === idTurno)?.nombre || '';

    _grupos.push(datos);
    _ordenarGrupos();
    _renderizarTabla();
    _cerrarFormulario();

    const etiqueta = `${datos.nivel_nombre}${datos.numero}`;
    UI.mostrarToast(`Grupo "${etiqueta}" creado correctamente.`, 'success');
  }

  async function _actualizarGrupo(id, idNivel, idTurno, numero) {
    const res   = await fetch(`${URL_GRUPOS()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_nivel: idNivel, id_turno: idTurno, numero }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner(datos.error || 'No se pudo actualizar el grupo.');
      throw new Error(datos.error);
    }

    // Completar nombres localmente
    datos.nivel_nombre = _niveles.find(n => n.id === idNivel)?.nombre || '';
    datos.turno_nombre = _turnos.find(t => t.id === idTurno)?.nombre || '';

    const idx = _grupos.findIndex(g => g.id === id);
    if (idx !== -1) _grupos[idx] = datos;
    _ordenarGrupos();
    _renderizarTabla();
    _cerrarFormulario();

    const etiqueta = `${datos.nivel_nombre}${datos.numero}`;
    UI.mostrarToast(`Grupo "${etiqueta}" actualizado correctamente.`, 'success');
  }

  async function _confirmarEliminar(grupo) {
    const etiqueta = `${grupo.nivel_nombre}${grupo.numero} (${grupo.turno_nombre})`;

    const confirmado = await UI.confirmar(
      'Eliminar grupo',
      `¿Estás seguro de que querés eliminar el grupo "${etiqueta}"?\n\nEsto eliminará también sus asignaciones de docentes y el horario del grupo. Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );
    if (!confirmado) return;

    try {
      const res   = await fetch(`${URL_GRUPOS()}/${grupo.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar el grupo.', 'error');
        return;
      }

      _grupos = _grupos.filter(g => g.id !== grupo.id);
      _renderizarTabla();
      if (_grupoEditando?.id === grupo.id) _cerrarFormulario();
      UI.mostrarToast(`Grupo "${etiqueta}" eliminado.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

  /** Ordena el cache de grupos por nivel → número ascendente. */
  function _ordenarGrupos() {
    _grupos.sort((a, b) => {
      const cmpNivel = (a.nivel_nombre || '').localeCompare(b.nivel_nombre || '', 'es');
      return cmpNivel !== 0 ? cmpNivel : a.numero - b.numero;
    });
  }

  function _mostrarErrorCampo(idError, idInput) {
    const span = document.getElementById(idError);
    const el   = document.getElementById(idInput);
    if (span) span.style.display = 'flex';
    el?.classList.add('error');
  }

  function _mostrarErrorBanner(mensaje) {
    const caja = document.getElementById('grupo-error-box');
    const msg  = document.getElementById('grupo-error-msg');
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

    // Estilos exclusivos del módulo Grupos
    if (document.getElementById('style-modulo-grupos')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-grupos';
    style.textContent = `
      /* ── Chip visual del nombre del grupo ── */
      .grupo-chip {
        display: inline-flex;
        align-items: stretch;
        border-radius: var(--radius-sm);
        overflow: hidden;
        font-size: var(--text-sm);
        font-weight: 700;
        letter-spacing: -0.01em;
        border: 1px solid var(--accent-border);
        line-height: 1;
      }

      .grupo-chip-nivel {
        background: var(--accent-subtle);
        color: var(--accent-hover);
        padding: 0.3rem 0.55rem;
        border-right: 1px solid var(--accent-border);
      }

      .grupo-chip-num {
        background: rgba(255,255,255,0.04);
        color: var(--text);
        padding: 0.3rem 0.55rem;
      }

      /* ── Vista previa en el formulario ── */
      .grupo-preview {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.65rem 0.9rem;
        background: var(--accent-subtle);
        border: 1px solid var(--accent-border);
        border-radius: var(--radius-sm);
        margin-top: 0.25rem;
        font-size: var(--text-sm);
        animation: fadeIn 0.2s ease;
      }

      .grupo-preview-label {
        color: var(--text-muted);
        font-size: var(--text-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .grupo-preview-turno {
        color: var(--text-muted);
        font-size: var(--text-xs);
      }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
