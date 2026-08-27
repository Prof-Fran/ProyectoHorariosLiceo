// ============================================================
// modulos/horarios.js — Módulo Turnos y Horarios por Turno
// Fase 6: Gestión de turnos y sus horas asociadas
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/formularios.css
// ============================================================

window.Modulo_turnos = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor    = null;   // Elemento raíz donde se renderiza
  let _turnos        = [];     // Cache de turnos [{id, nombre}]
  let _horarios      = [];     // Cache de todas las horas de turno
  let _turnoEditando = null;   // null = creando / objeto = editando turno
  let _horaEditando  = null;   // null = nueva / objeto = editando hora

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_TURNOS   = () => `${App.API_BASE}/turnos`;
  const URL_HORARIOS = () => `${App.API_BASE}/horarios_turno`;

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
      <div class="modulo-layout-split" id="turnos-layout">

        <!-- ── Columna izquierda: lista de turnos ── -->
        <div class="modulo-col-lista" id="turnos-col-lista">

          ${UI.headerModulo(
            'Turnos y Horarios',
            'Configurá los turnos y las horas de cada uno',
            `<button class="btn btn-primary" id="btn-nuevo-turno">
               <i class="fa-solid fa-plus" aria-hidden="true"></i>
               Nuevo turno
             </button>`
          )}

          <!-- Listado de tarjetas de turnos -->
          <div id="turnos-lista-wrap"></div>

        </div>

        <!-- ── Columna derecha: formulario de turno / hora ── -->
        <div class="modulo-col-form oculta" id="turnos-col-form">
          <div id="turnos-form-wrap"></div>
        </div>

      </div>
    `;

    _inyectarEstilos();

    // Evento botón nuevo turno
    document.getElementById('btn-nuevo-turno')
      ?.addEventListener('click', _abrirFormularioNuevoTurno);

    // Cargar datos iniciales
    await _cargarTodo();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  /**
   * Carga turnos y todas sus horas en paralelo.
   */
  async function _cargarTodo() {
    const wrap = document.getElementById('turnos-lista-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando turnos...');

    try {
      const [rTurnos, rHorarios] = await Promise.all([
        fetch(URL_TURNOS()),
        fetch(URL_HORARIOS()),
      ]);

      if (!rTurnos.ok || !rHorarios.ok) throw new Error('Error al obtener datos');

      _turnos   = await rTurnos.json();
      _horarios = await rHorarios.json();

      _renderizarListaTurnos();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  /**
   * Recarga solo las horas de un turno específico (sin recargar la lista completa).
   * @param {number} idTurno
   */
  async function _recargarHorasDeTurno(idTurno) {
    try {
      const res = await fetch(`${URL_HORARIOS()}/por_turno/${idTurno}`);
      if (!res.ok) return;
      const horas = await res.json();
      // Actualizar en el cache global
      _horarios = _horarios.filter(h => h.id_turno !== idTurno);
      _horarios.push(...horas);
      // Re-renderizar solo el panel de horas de ese turno
      _renderizarPanelHoras(idTurno);
    } catch { /* silenciar */ }
  }

  // ════════════════════════════════════════════════════════════
  //  LISTA DE TURNOS (TARJETAS EXPANDIBLES)
  // ════════════════════════════════════════════════════════════

  /**
   * Renderiza la lista de tarjetas de turnos.
   */
  function _renderizarListaTurnos() {
    const wrap = document.getElementById('turnos-lista-wrap');
    if (!wrap) return;

    if (_turnos.length === 0) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-clock',
        'No hay turnos registrados',
        'Creá el primer turno usando el botón superior.',
        `<button class="btn btn-primary" onclick="document.getElementById('btn-nuevo-turno').click()">
           <i class="fa-solid fa-plus" aria-hidden="true"></i> Nuevo turno
         </button>`
      );
      return;
    }

    wrap.innerHTML = `
      <div class="turnos-lista" id="turnos-lista">
        ${_turnos.map(turno => _htmlTarjetaTurno(turno)).join('')}
      </div>
    `;

    // Eventos en la lista (delegación)
    document.getElementById('turnos-lista')
      ?.addEventListener('click', _manejarClickLista);
  }

  /**
   * Genera el HTML de una tarjeta de turno con su panel de horas.
   * @param {{ id: number, nombre: string }} turno
   * @returns {string}
   */
  function _htmlTarjetaTurno(turno) {
    const horasTurno = _horasDelTurno(turno.id);

    return `
      <div class="turno-card" data-turno-id="${turno.id}" id="turno-card-${turno.id}">

        <!-- Encabezado del turno -->
        <div class="turno-card-header">
          <div class="turno-card-info">
            <i class="fa-solid fa-clock" aria-hidden="true" style="color:var(--accent-hover);font-size:.9rem;"></i>
            <span class="turno-card-nombre">${_esc(turno.nombre)}</span>
            <span class="turno-card-badge">${horasTurno.length} hora${horasTurno.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="turno-card-acciones">
            <button class="btn-icono btn-icono-editar"
                    data-accion="editar-turno" data-id="${turno.id}"
                    title="Editar turno" aria-label="Editar turno ${_esc(turno.nombre)}">
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
            </button>
            <button class="btn-icono btn-icono-eliminar"
                    data-accion="eliminar-turno" data-id="${turno.id}"
                    title="Eliminar turno" aria-label="Eliminar turno ${_esc(turno.nombre)}">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <!-- Panel de horas del turno -->
        <div class="turno-horas-panel" id="turno-horas-${turno.id}">
          ${_htmlPanelHoras(turno.id)}
        </div>

      </div>
    `;
  }

  /**
   * Genera el HTML interno del panel de horas de un turno.
   * @param {number} idTurno
   * @returns {string}
   */
  function _htmlPanelHoras(idTurno) {
    const horas = _horasDelTurno(idTurno);

    const filas = horas.length > 0
      ? horas.map(h => `
          <tr class="hora-fila" data-hora-id="${h.id}">
            <td>
              <span class="hora-numero">Hora ${h.numero_hora}</span>
            </td>
            <td>
              <span class="hora-rango">
                <i class="fa-regular fa-clock" aria-hidden="true"></i>
                ${_esc(h.hora_inicio)} — ${_esc(h.hora_fin)}
              </span>
            </td>
            <td class="col-acciones">
              <div class="fila-acciones">
                <button class="btn-icono btn-icono-editar"
                        data-accion="editar-hora" data-id="${h.id}" data-turno-id="${idTurno}"
                        title="Editar hora ${h.numero_hora}"
                        aria-label="Editar hora ${h.numero_hora}">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                </button>
                <button class="btn-icono btn-icono-eliminar"
                        data-accion="eliminar-hora" data-id="${h.id}" data-turno-id="${idTurno}"
                        title="Eliminar hora ${h.numero_hora}"
                        aria-label="Eliminar hora ${h.numero_hora}">
                  <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" class="horas-vacias">
           <i class="fa-regular fa-clock" aria-hidden="true"></i>
           Sin horas configuradas
         </td></tr>`;

    return `
      <div class="horas-tabla-wrap">
        <table class="horas-tabla">
          <thead>
            <tr>
              <th>N°</th>
              <th>Horario</th>
              <th class="col-acciones">
                <button class="btn btn-sm btn-secondary" style="float:right;"
                        data-accion="nueva-hora" data-turno-id="${idTurno}"
                        aria-label="Agregar hora al turno">
                  <i class="fa-solid fa-plus" aria-hidden="true"></i>
                  Agregar hora
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Re-renderiza solo el panel de horas de un turno (sin tocar el resto).
   * @param {number} idTurno
   */
  function _renderizarPanelHoras(idTurno) {
    const panel = document.getElementById(`turno-horas-${idTurno}`);
    if (!panel) return;
    panel.innerHTML = _htmlPanelHoras(idTurno);

    // Actualizar badge de cantidad de horas
    const badge = document.querySelector(`#turno-card-${idTurno} .turno-card-badge`);
    const horas = _horasDelTurno(idTurno);
    if (badge) badge.textContent = `${horas.length} hora${horas.length !== 1 ? 's' : ''}`;
  }

  // ════════════════════════════════════════════════════════════
  //  DELEGACIÓN DE EVENTOS EN LA LISTA
  // ════════════════════════════════════════════════════════════

  /**
   * Maneja todos los clics en la lista de turnos por delegación.
   * @param {MouseEvent} e
   */
  function _manejarClickLista(e) {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;

    const { accion, id, turnoId } = boton.dataset;
    const idNum      = Number(id);
    const turnoIdNum = Number(turnoId);

    switch (accion) {
      case 'editar-turno': {
        const turno = _turnos.find(t => t.id === idNum);
        if (turno) _abrirFormularioEditarTurno(turno);
        break;
      }
      case 'eliminar-turno': {
        const turno = _turnos.find(t => t.id === idNum);
        if (turno) _confirmarEliminarTurno(turno);
        break;
      }
      case 'nueva-hora': {
        _abrirFormularioNuevaHora(turnoIdNum);
        break;
      }
      case 'editar-hora': {
        const hora = _horarios.find(h => h.id === idNum);
        if (hora) _abrirFormularioEditarHora(hora);
        break;
      }
      case 'eliminar-hora': {
        const hora = _horarios.find(h => h.id === idNum);
        if (hora) _confirmarEliminarHora(hora);
        break;
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  FORMULARIO DE TURNO (nombre)
  // ════════════════════════════════════════════════════════════

  function _abrirFormularioNuevoTurno() {
    _turnoEditando = null;
    _horaEditando  = null;
    _mostrarFormulario(_htmlFormularioTurno('Nuevo turno', ''));
    setTimeout(() => document.getElementById('turno-input-nombre')?.focus(), 80);
  }

  /**
   * @param {{ id: number, nombre: string }} turno
   */
  function _abrirFormularioEditarTurno(turno) {
    _turnoEditando = turno;
    _horaEditando  = null;
    _mostrarFormulario(_htmlFormularioTurno('Editar turno', turno.nombre));
    setTimeout(() => document.getElementById('turno-input-nombre')?.focus(), 80);
  }

  /**
   * Genera el HTML del formulario de turno.
   * @param {string} titulo
   * @param {string} valorNombre
   * @returns {string}
   */
  function _htmlFormularioTurno(titulo, valorNombre) {
    return `
      <div class="form-panel">
        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-solid fa-clock" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo">${_esc(titulo)}</span>
        </div>

        <form id="form-turno" novalidate autocomplete="off">
          <div class="form-panel-body">

            <div class="form-error-box" id="turno-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="turno-error-msg"></span>
            </div>

            <div class="campo-grupo">
              <label class="campo-label" for="turno-input-nombre">
                Nombre del turno <span class="requerido" aria-hidden="true">*</span>
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-clock input-icono-izq" aria-hidden="true"></i>
                <input
                  id="turno-input-nombre"
                  type="text"
                  class="campo-input"
                  placeholder="Ej: Matutino, Vespertino, Nocturno"
                  value="${_esc(valorNombre)}"
                  maxlength="60"
                  required
                />
              </div>
              <span class="campo-error" id="turno-error-nombre" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                El nombre es obligatorio.
              </span>
            </div>

          </div>
          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="form-btn-cancelar">Cancelar</button>
            <button type="submit"  class="btn btn-primary"   id="form-btn-guardar">
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
  //  FORMULARIO DE HORA (numero_hora, hora_inicio, hora_fin)
  // ════════════════════════════════════════════════════════════

  /**
   * Abre el formulario para agregar una nueva hora a un turno.
   * @param {number} idTurno
   */
  function _abrirFormularioNuevaHora(idTurno) {
    _horaEditando  = null;
    _turnoEditando = null;

    // Calcular el próximo número de hora automáticamente
    const horasActuales  = _horasDelTurno(idTurno);
    const proximoNumero  = horasActuales.length > 0
      ? Math.max(...horasActuales.map(h => h.numero_hora)) + 1
      : 1;

    const turno = _turnos.find(t => t.id === idTurno);

    _mostrarFormulario(_htmlFormularioHora(
      `Agregar hora — ${_esc(turno?.nombre || '')}`,
      idTurno,
      null,   // sin datos de edición
      proximoNumero
    ));
    setTimeout(() => document.getElementById('hora-input-inicio')?.focus(), 80);
  }

  /**
   * Abre el formulario para editar una hora existente.
   * @param {Object} hora - Registro de horario_turno
   */
  function _abrirFormularioEditarHora(hora) {
    _horaEditando  = hora;
    _turnoEditando = null;

    const turno = _turnos.find(t => t.id === hora.id_turno);

    _mostrarFormulario(_htmlFormularioHora(
      `Editar hora ${hora.numero_hora} — ${_esc(turno?.nombre || '')}`,
      hora.id_turno,
      hora,
      hora.numero_hora
    ));
    setTimeout(() => document.getElementById('hora-input-inicio')?.focus(), 80);
  }

  /**
   * Genera el HTML del formulario de hora.
   * @param {string} titulo
   * @param {number} idTurno
   * @param {Object|null} hora - Datos actuales para edición
   * @param {number} numeroHora
   * @returns {string}
   */
  function _htmlFormularioHora(titulo, idTurno, hora, numeroHora) {
    return `
      <div class="form-panel">
        <div class="form-panel-header">
          <div class="form-panel-icon">
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
          </div>
          <span class="form-panel-titulo">${_esc(titulo)}</span>
        </div>

        <form id="form-hora" novalidate autocomplete="off">
          <input type="hidden" id="hora-input-turno-id"    value="${idTurno}">
          <input type="hidden" id="hora-input-numero-hora" value="${numeroHora}">

          <div class="form-panel-body">

            <div class="form-error-box" id="hora-error-box" role="alert" aria-live="polite">
              <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              <span id="hora-error-msg"></span>
            </div>

            <!-- N° de hora (solo lectura en edición, editable en nuevo) -->
            <div class="campo-grupo">
              <label class="campo-label" for="hora-input-num-visual">
                Número de hora
              </label>
              <div class="input-wrapper">
                <i class="fa-solid fa-hashtag input-icono-izq" aria-hidden="true"></i>
                <input
                  id="hora-input-num-visual"
                  type="number"
                  class="campo-input"
                  value="${numeroHora}"
                  min="1"
                  max="20"
                  ${hora ? 'readonly style="opacity:.55;cursor:not-allowed;"' : ''}
                />
              </div>
              ${hora ? '<span class="campo-ayuda">El número de hora no se puede cambiar.</span>' : ''}
              <span class="campo-error" id="hora-error-num" style="display:none" aria-live="polite">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                Ingresá un número de hora válido (mayor a 0).
              </span>
            </div>

            <!-- Horario en dos columnas -->
            <div class="form-row form-row-2">

              <div class="campo-grupo" style="margin-bottom:0">
                <label class="campo-label" for="hora-input-inicio">
                  Hora inicio <span class="requerido" aria-hidden="true">*</span>
                </label>
                <input
                  id="hora-input-inicio"
                  type="time"
                  class="campo-input"
                  value="${hora ? _esc(hora.hora_inicio) : ''}"
                  required
                />
                <span class="campo-error" id="hora-error-inicio" style="display:none" aria-live="polite">
                  <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                  La hora de inicio es obligatoria.
                </span>
              </div>

              <div class="campo-grupo" style="margin-bottom:0">
                <label class="campo-label" for="hora-input-fin">
                  Hora fin <span class="requerido" aria-hidden="true">*</span>
                </label>
                <input
                  id="hora-input-fin"
                  type="time"
                  class="campo-input"
                  value="${hora ? _esc(hora.hora_fin) : ''}"
                  required
                />
                <span class="campo-error" id="hora-error-fin" style="display:none" aria-live="polite">
                  <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                  La hora de fin es obligatoria.
                </span>
              </div>

            </div><!-- /form-row -->

          </div><!-- /form-panel-body -->

          <div class="form-panel-footer">
            <button type="button" class="btn btn-secondary" id="form-btn-cancelar">Cancelar</button>
            <button type="submit"  class="btn btn-primary"   id="form-btn-guardar">
              <span class="btn-text">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                Guardar hora
              </span>
              <div class="btn-spinner" aria-hidden="true"></div>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  MOSTRAR / CERRAR EL PANEL DE FORMULARIO
  // ════════════════════════════════════════════════════════════

  /**
   * Muestra el panel lateral con el HTML dado y conecta los eventos
   * del formulario que esté presente (form-turno o form-hora).
   * @param {string} html
   */
  function _mostrarFormulario(html) {
    const wrap = document.getElementById('turnos-form-wrap');
    const col  = document.getElementById('turnos-col-form');
    if (!wrap || !col) return;

    wrap.innerHTML = html;
    col.classList.remove('oculta');

    // Botón cancelar (común a ambos formularios)
    document.getElementById('form-btn-cancelar')
      ?.addEventListener('click', _cerrarFormulario, { once: true });

    // Conectar submit del formulario correspondiente
    document.getElementById('form-turno')
      ?.addEventListener('submit', _manejarEnvioTurno, { once: true });

    document.getElementById('form-hora')
      ?.addEventListener('submit', _manejarEnvioHora, { once: true });

    // Limpiar errores al escribir
    document.getElementById('turno-input-nombre')
      ?.addEventListener('input', () => {
        document.getElementById('turno-error-box')?.classList.remove('visible');
        document.getElementById('turno-error-nombre') &&
          (document.getElementById('turno-error-nombre').style.display = 'none');
        document.getElementById('turno-input-nombre')?.classList.remove('error');
      });
  }

  /** Cierra el panel lateral y resetea el estado. */
  function _cerrarFormulario() {
    const col = document.getElementById('turnos-col-form');
    col?.classList.add('oculta');
    const wrap = document.getElementById('turnos-form-wrap');
    if (wrap) wrap.innerHTML = '';
    _turnoEditando = null;
    _horaEditando  = null;
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO DE TURNO
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvioTurno(e) {
    e.preventDefault();

    const inputNombre = document.getElementById('turno-input-nombre');
    const nombre      = inputNombre?.value.trim() || '';

    // Validación cliente
    if (!nombre) {
      document.getElementById('turno-error-nombre') &&
        (document.getElementById('turno-error-nombre').style.display = 'flex');
      inputNombre?.classList.add('error');
      inputNombre?.focus();
      document.getElementById('form-turno')
        ?.addEventListener('submit', _manejarEnvioTurno, { once: true });
      return;
    }

    const btn = document.getElementById('form-btn-guardar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      if (_turnoEditando) {
        await _actualizarTurno(_turnoEditando.id, nombre);
      } else {
        await _crearTurno(nombre);
      }
    } catch {
      document.getElementById('form-turno')
        ?.addEventListener('submit', _manejarEnvioTurno, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  ENVÍO DEL FORMULARIO DE HORA
  // ════════════════════════════════════════════════════════════

  async function _manejarEnvioHora(e) {
    e.preventDefault();

    const idTurno   = Number(document.getElementById('hora-input-turno-id')?.value);
    const numVisual = Number(document.getElementById('hora-input-num-visual')?.value);
    const inicio    = document.getElementById('hora-input-inicio')?.value?.trim() || '';
    const fin       = document.getElementById('hora-input-fin')?.value?.trim()   || '';

    // Validaciones
    let hayError = false;

    if (!_horaEditando && (!numVisual || numVisual < 1)) {
      document.getElementById('hora-error-num') &&
        (document.getElementById('hora-error-num').style.display = 'flex');
      hayError = true;
    }

    if (!inicio) {
      document.getElementById('hora-error-inicio') &&
        (document.getElementById('hora-error-inicio').style.display = 'flex');
      document.getElementById('hora-input-inicio')?.classList.add('error');
      hayError = true;
    }

    if (!fin) {
      document.getElementById('hora-error-fin') &&
        (document.getElementById('hora-error-fin').style.display = 'flex');
      document.getElementById('hora-input-fin')?.classList.add('error');
      hayError = true;
    }

    if (inicio && fin && inicio >= fin) {
      const errBox = document.getElementById('hora-error-box');
      const errMsg = document.getElementById('hora-error-msg');
      if (errMsg) errMsg.textContent = 'La hora de inicio debe ser anterior a la hora de fin.';
      errBox?.classList.add('visible');
      hayError = true;
    }

    if (hayError) {
      document.getElementById('form-hora')
        ?.addEventListener('submit', _manejarEnvioHora, { once: true });
      return;
    }

    const btn = document.getElementById('form-btn-guardar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    try {
      if (_horaEditando) {
        await _actualizarHora(_horaEditando.id, inicio, fin);
      } else {
        await _crearHora(idTurno, numVisual, inicio, fin);
      }
    } catch {
      document.getElementById('form-hora')
        ?.addEventListener('submit', _manejarEnvioHora, { once: true });
    } finally {
      btn?.classList.remove('loading');
      btn && (btn.disabled = false);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD — TURNOS
  // ════════════════════════════════════════════════════════════

  async function _crearTurno(nombre) {
    const res   = await fetch(URL_TURNOS(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner('turno-error-box', 'turno-error-msg', datos.error || 'No se pudo crear el turno.');
      throw new Error(datos.error);
    }

    _turnos.push(datos);
    _renderizarListaTurnos();
    _cerrarFormulario();
    UI.mostrarToast(`Turno "${datos.nombre}" creado correctamente.`, 'success');
  }

  async function _actualizarTurno(id, nombre) {
    const res   = await fetch(`${URL_TURNOS()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner('turno-error-box', 'turno-error-msg', datos.error || 'No se pudo actualizar el turno.');
      throw new Error(datos.error);
    }

    const idx = _turnos.findIndex(t => t.id === id);
    if (idx !== -1) _turnos[idx] = datos;
    _renderizarListaTurnos();
    _cerrarFormulario();
    UI.mostrarToast(`Turno "${datos.nombre}" actualizado.`, 'success');
  }

  async function _confirmarEliminarTurno(turno) {
    // Advertir si tiene horas configuradas
    const horas = _horasDelTurno(turno.id);
    const mensaje = horas.length > 0
      ? `⚠️ El turno "${turno.nombre}" tiene ${horas.length} hora(s) configurada(s) y puede tener grupos asociados.\n\nEliminarlo borrará también sus horarios y grupos. ¿Estás seguro?`
      : `¿Estás seguro de que querés eliminar el turno "${turno.nombre}"? Esta acción no se puede deshacer.`;

    const confirmado = await UI.confirmar('Eliminar turno', mensaje, {
      labelConfirmar: 'Eliminar',
      variante:       'danger',
    });
    if (!confirmado) return;

    try {
      const res = await fetch(`${URL_TURNOS()}/${turno.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar el turno.', 'error');
        return;
      }

      _turnos   = _turnos.filter(t => t.id !== turno.id);
      _horarios = _horarios.filter(h => h.id_turno !== turno.id);
      _renderizarListaTurnos();
      _cerrarFormulario();
      UI.mostrarToast(`Turno "${turno.nombre}" eliminado.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  OPERACIONES CRUD — HORAS
  // ════════════════════════════════════════════════════════════

  async function _crearHora(idTurno, numeroHora, horaInicio, horaFin) {
    const res   = await fetch(URL_HORARIOS(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        id_turno:    idTurno,
        numero_hora: numeroHora,
        hora_inicio: horaInicio,
        hora_fin:    horaFin,
      }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner('hora-error-box', 'hora-error-msg', datos.error || 'No se pudo agregar la hora.');
      throw new Error(datos.error);
    }

    _horarios.push(datos);
    _renderizarPanelHoras(idTurno);
    _cerrarFormulario();
    UI.mostrarToast(`Hora ${numeroHora} agregada al turno.`, 'success');
  }

  async function _actualizarHora(id, horaInicio, horaFin) {
    const res   = await fetch(`${URL_HORARIOS()}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ hora_inicio: horaInicio, hora_fin: horaFin }),
    });
    const datos = await res.json();

    if (!res.ok) {
      _mostrarErrorBanner('hora-error-box', 'hora-error-msg', datos.error || 'No se pudo actualizar la hora.');
      throw new Error(datos.error);
    }

    const idx = _horarios.findIndex(h => h.id === id);
    if (idx !== -1) _horarios[idx] = { ..._horarios[idx], hora_inicio: horaInicio, hora_fin: horaFin };
    _renderizarPanelHoras(datos.id_turno || _horaEditando?.id_turno);
    _cerrarFormulario();
    UI.mostrarToast(`Hora actualizada correctamente.`, 'success');
  }

  async function _confirmarEliminarHora(hora) {
    const confirmado = await UI.confirmar(
      'Eliminar hora',
      `¿Estás seguro de que querés eliminar la hora ${hora.numero_hora} (${hora.hora_inicio} — ${hora.hora_fin})? Esta acción no se puede deshacer.`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );
    if (!confirmado) return;

    try {
      const res = await fetch(`${URL_HORARIOS()}/${hora.id}`, { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo eliminar la hora.', 'error');
        return;
      }

      const idTurno = hora.id_turno;
      _horarios = _horarios.filter(h => h.id !== hora.id);
      _renderizarPanelHoras(idTurno);
      UI.mostrarToast(`Hora ${hora.numero_hora} eliminada.`, 'success');
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

  /**
   * Devuelve las horas ordenadas de un turno desde el cache.
   * @param {number} idTurno
   * @returns {Array}
   */
  function _horasDelTurno(idTurno) {
    return _horarios
      .filter(h => h.id_turno === idTurno)
      .sort((a, b) => a.numero_hora - b.numero_hora);
  }

  /**
   * Muestra el banner de error de un formulario.
   * @param {string} idCaja
   * @param {string} idMsg
   * @param {string} mensaje
   */
  function _mostrarErrorBanner(idCaja, idMsg, mensaje) {
    const caja = document.getElementById(idCaja);
    const msg  = document.getElementById(idMsg);
    if (msg)  msg.textContent = mensaje;
    caja?.classList.add('visible');
  }

  /** Escapa HTML para prevenir XSS. */
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
  //  ESTILOS ADICIONALES DEL MÓDULO
  // ════════════════════════════════════════════════════════════

  function _inyectarEstilos() {
    // Estilos del layout split (compartidos con otros módulos)
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

    // Estilos específicos del módulo de turnos
    if (document.getElementById('style-modulo-turnos')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-turnos';
    style.textContent = `
      /* ── Lista de turnos ── */
      .turnos-lista {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      /* ── Tarjeta de turno ── */
      .turno-card {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        transition: border-color var(--transition);
      }

      .turno-card:hover {
        border-color: var(--glass-border-h);
      }

      /* Encabezado de la tarjeta */
      .turno-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.1rem;
        background: rgba(255,255,255,0.02);
        border-bottom: 1px solid var(--glass-border);
        gap: 0.75rem;
      }

      .turno-card-info {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex: 1;
        min-width: 0;
      }

      .turno-card-nombre {
        font-size: var(--text-md);
        font-weight: 700;
        color: var(--text);
        letter-spacing: -0.01em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .turno-card-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.55rem;
        background: var(--accent-subtle);
        border: 1px solid var(--accent-border);
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--accent-hover);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .turno-card-acciones {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
      }

      /* ── Panel de horas ── */
      .turno-horas-panel {
        padding: 0.75rem 1rem 1rem;
      }

      /* Tabla de horas */
      .horas-tabla-wrap {
        overflow: hidden;
        border-radius: var(--radius-sm);
        border: 1px solid var(--glass-border);
      }

      .horas-tabla {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }

      .horas-tabla thead {
        background: rgba(255,255,255,0.025);
        border-bottom: 1px solid var(--glass-border);
      }

      .horas-tabla th {
        padding: 0.55rem 0.85rem;
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        text-align: left;
      }

      .horas-tabla th.col-acciones {
        text-align: right;
        padding-right: 0.85rem;
      }

      .horas-tabla tbody tr {
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background var(--transition);
      }

      .horas-tabla tbody tr:last-child {
        border-bottom: none;
      }

      .horas-tabla tbody tr:hover {
        background: rgba(255,255,255,0.03);
      }

      .horas-tabla td {
        padding: 0.55rem 0.85rem;
        color: var(--text);
        vertical-align: middle;
      }

      .horas-tabla td.col-acciones {
        text-align: right;
        white-space: nowrap;
      }

      /* Celda vacía de horas */
      .horas-vacias {
        text-align: center !important;
        color: var(--text-muted);
        font-size: var(--text-xs);
        padding: 1.25rem !important;
        font-style: italic;
      }

      .horas-vacias i {
        margin-right: 0.4rem;
        opacity: 0.5;
      }

      /* Número de hora */
      .hora-numero {
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      /* Rango horario */
      .hora-rango {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
        color: var(--text);
      }

      .hora-rango i {
        color: var(--text-muted);
        font-size: 0.8em;
      }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
