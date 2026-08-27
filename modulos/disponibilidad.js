// ============================================================
// modulos/disponibilidad.js — Módulo Disponibilidad Docente
// Fase 6: Grilla semanal de horas ocupadas en otras instituciones
// El usuario selecciona un docente y un turno; la grilla muestra
// Lunes–Viernes × horas del turno. Cada celda marca si el docente
// está ocupado fuera del liceo en ese bloque. Se auto-guarda.
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css,
//             css/horario.css (sección disponibles)
// ============================================================

window.Modulo_disponibilidad = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor    = null;  // Elemento raíz
  let _docentes      = [];    // Lista de docentes (select)
  let _turnos        = [];    // Lista de turnos (select)
  let _horasTurno    = [];    // Horas del turno seleccionado (filas)
  let _estadoActual  = new Map(); // Estado visual actual: clave "dia:numhora" → ocupado (true/false)
  let _cambios       = new Map(); // Cambios pendientes sin guardar: clave "dia:numhora" → ocupado
  let _docenteId     = null;  // Docente seleccionado
  let _turnoId       = null;  // Turno seleccionado
  let _guardando     = false; // Bloquea clics durante el guardado

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_DOC  = () => `${App.API_BASE}/docentes`;
  const URL_TUR  = () => `${App.API_BASE}/turnos`;
  const URL_HOR  = () => `${App.API_BASE}/horarios_turno/por_turno`;
  const URL_DISP = () => `${App.API_BASE}/disponibilidad`;

  // Días de la semana (1 = Lunes ... 5 = Viernes)
  const DIAS = [
    { id: 1, nombre: 'Lunes' },
    { id: 2, nombre: 'Martes' },
    { id: 3, nombre: 'Miércoles' },
    { id: 4, nombre: 'Jueves' },
    { id: 5, nombre: 'Viernes' },
  ];

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  async function render(contenedor) {
    _contenedor = contenedor;

    _contenedor.innerHTML = `
      <div class="disponibilidad-layout">

        ${UI.headerModulo(
          'Disponibilidad Docente',
          'Horas en las que cada docente está ocupado en otras instituciones'
        )}

        <!-- Selector de docente y turno -->
        <div class="disp-selector">
          <div class="campo-grupo">
            <label class="campo-label" for="disp-select-docente">Docente</label>
            <div class="select-wrapper">
              <i class="fa-solid fa-chalkboard-user input-icono-izq" aria-hidden="true"></i>
              <select id="disp-select-docente" class="campo-select">
                <option value="">— Seleccioná un docente —</option>
              </select>
            </div>
          </div>

          <div class="campo-grupo">
            <label class="campo-label" for="disp-select-turno">Turno</label>
            <div class="select-wrapper">
              <i class="fa-solid fa-clock input-icono-izq" aria-hidden="true"></i>
              <select id="disp-select-turno" class="campo-select">
                <option value="">— Seleccioná un turno —</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Leyenda de colores -->
        <div class="leyenda-colores">
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-vacio"></span> Disponible en el liceo
          </span>
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-ext"></span> Ocupado en otra institución
          </span>
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-advertencia"></span> Hora no disponible
          </span>
        </div>

        <!-- Grilla -->
        <div id="disp-tabla-wrap"></div>

      </div>
    `;

    _inyectarEstilos();

    document.getElementById('disp-select-docente')
      ?.addEventListener('change', _manejarCambioDocente);
    document.getElementById('disp-select-turno')
      ?.addEventListener('change', _manejarCambioTurno);

    await _cargarDatos();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS BASE (docentes y turnos)
  // ════════════════════════════════════════════════════════════

  async function _cargarDatos() {
    const wrap = document.getElementById('disp-tabla-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando datos...');

    try {
      const [rDoc, rTur] = await Promise.all([
        fetch(URL_DOC()),
        fetch(URL_TUR()),
      ]);
      if (!rDoc.ok || !rTur.ok) throw new Error('Error al obtener datos');

      _docentes = await rDoc.json();
      _turnos   = await rTur.json();

      _poblarSelectDocente();
      _poblarSelectTurno();

      // Estado vacío hasta elegir docente + turno
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-calendar-check',
        'Seleccioná un docente y un turno',
        'Para comenzar, elegí un docente y el turno en el que dicta clases.',
        `<button class="btn btn-primary" id="disp-btn-iniciar" style="margin-top:.5rem">
           <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
           Cargar grilla
         </button>`
      );

      document.getElementById('disp-btn-iniciar')
        ?.addEventListener('click', _intentarCargarGrilla);
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  function _poblarSelectDocente() {
    const sel = document.getElementById('disp-select-docente');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccioná un docente —</option>' +
      _docentes.map(d =>
        `<option value="${d.id}">${_esc(d.apellido)}, ${_esc(d.nombre)}</option>`
      ).join('');
  }

  function _poblarSelectTurno() {
    const sel = document.getElementById('disp-select-turno');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccioná un turno —</option>' +
      _turnos.map(t => `<option value="${t.id}">${_esc(t.nombre)}</option>`).join('');
  }

  // ════════════════════════════════════════════════════════════
  //  MANEJO DE SELECCIÓN
  // ════════════════════════════════════════════════════════════

  function _intentarCargarGrilla() {
    const idDoc = Number(document.getElementById('disp-select-docente')?.value) || 0;
    const idTur = Number(document.getElementById('disp-select-turno')?.value) || 0;

    if (!idDoc || !idTur) {
      UI.mostrarToast(
        !idDoc ? 'Seleccioná un docente.' : 'Seleccioná un turno.',
        'warning'
      );
      return;
    }

    _docenteId = idDoc;
    _turnoId   = idTur;
    _cargarGrilla();
  }

  function _manejarCambioDocente(e) {
    _docenteId = Number(e.target.value) || null;
    _intentarMostrarGrilla();
  }

  function _manejarCambioTurno(e) {
    _turnoId = Number(e.target.value) || null;
    _intentarMostrarGrilla();
  }

  function _intentarMostrarGrilla() {
    if (_docenteId && _turnoId) _cargarGrilla();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE GRIILLA
  // ════════════════════════════════════════════════════════════

  async function _cargarGrilla() {
    const wrap = document.getElementById('disp-tabla-wrap');
    if (!wrap) return;
    UI.mostrarCargando(wrap, 'Cargando disponibilidad...');

    try {
      const [rHoras, rDisp] = await Promise.all([
        fetch(`${URL_HOR()}/${_turnoId}`),
        fetch(`${URL_DISP()}/por_docente/${_docenteId}`),
      ]);
      if (!rHoras.ok || !rDisp.ok) throw new Error('Error al obtener disponibilidad');

      _horasTurno = await rHoras.json();

      // Estado actual: iniciar con lo que ya está guardado en la BD
      _estadoActual = new Map();
      (await rDisp.json()).forEach(reg => {
        _estadoActual.set(`${reg.dia_semana}:${reg.numero_hora}`, true);
      });

      // Limpiar cambios pendientes de una sesión anterior
      _cambios = new Map();

      if (_horasTurno.length === 0) {
        UI.renderizarVacio(
          wrap,
          'fa-solid fa-clock',
          'El turno no tiene horas configuradas',
          'Cargá las horas del turno desde el módulo "Turnos y Horarios".'
        );
        return;
      }

      _renderizarGrilla();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  /** Renderiza la tabla de disponibilidad. */
  function _renderizarGrilla() {
    const wrap = document.getElementById('disp-tabla-wrap');
    if (!wrap) return;

    const theadHTML = `
      <tr>
        <th>Horas</th>
        ${DIAS.map(d => `<th>${_esc(d.nombre)}</th>`).join('')}
      </tr>
    `;

    const tbodyHTML = _horasTurno.map(h => {
      const etiqueta = `Hora ${h.numero_hora}`;
      const rango    = `${_formatearHora(h.hora_inicio)}–${_formatearHora(h.hora_fin)}`;

      const celdas = DIAS.map(d => {
        const clave = `${d.id}:${h.numero_hora}`;
        const ocupado = _estadoActual.get(clave) === true;
        return `
          <td>
            <button
              class="disp-celda ${ocupado ? 'ocupado' : ''}"
              data-dia="${d.id}"
              data-numhora="${h.numero_hora}"
              title="${ocupado ? 'Disponible en el liceo' : 'Marque como ocupado en otra institución'}"
              aria-label="${_esc(d.nombre)} hora ${h.numero_hora} ${ocupado ? 'ocupado' : 'disponible'}"
              aria-pressed="${ocupado}"
            >
              ${ocupado ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' : ''}
            </button>
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td>
            <div style="display:flex;flex-direction:column;line-height:1.3;">
              <span style="color:var(--text);font-weight:600;font-size:var(--text-xs);">${_esc(etiqueta)}</span>
              <span style="font-size:var(--text-xs);opacity:.65;">${rango}</span>
            </div>
          </td>
          ${celdas}
        </tr>
      `;
    }).join('');

    const nCambios = _cambios.size;

    wrap.innerHTML = `
      <div class="disponibilidad-tabla-wrap">
        <table class="tabla-disponibilidad">
          <thead>${theadHTML}</thead>
          <tbody>${tbodyHTML}</tbody>
        </table>
      </div>

      <div class="disp-acciones">
        <p class="disp-ayuda">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          Hacé clic en una celda para marcar/desmarcar si el docente está ocupado en esa hora fuera del liceo. Cuando termines, presioná <strong>Confirmar</strong> para guardar los cambios.
        </p>
        <button class="btn btn-primary" id="disp-btn-confirmar" ${nCambios === 0 ? 'disabled' : ''}>
          <span class="btn-text">
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            Confirmar cambios <span id="disp-cambios-count" style="opacity:.8">${nCambios > 0 ? `(${nCambios})` : ''}</span>
          </span>
          <div class="btn-spinner" aria-hidden="true"></div>
        </button>
      </div>
    `;

    wrap.addEventListener('click', _manejarClickCelda, { once: true });
    document.getElementById('disp-btn-confirmar')
      ?.addEventListener('click', _confirmarGuardado);
  }

  function _manejarClickCelda(e) {
    const wrap  = document.getElementById('disp-tabla-wrap');
    const celda = e.target.closest('.disp-celda');

    if (!celda) {
      wrap?.addEventListener('click', _manejarClickCelda, { once: true });
      return;
    }

    _alternarCelda(celda);
    wrap?.addEventListener('click', _manejarClickCelda, { once: true });
  }

  /** Alterna el estado visual de una celda (sin guardar todavía). */
  function _alternarCelda(celda) {
    if (_guardando) return;

    const dia      = Number(celda.dataset.dia);
    const numHora  = Number(celda.dataset.numhora);
    const clave    = `${dia}:${numHora}`;

    // Nueva ocupación = estado actual invertido
    const actual    = _estadoActual.get(clave) === true;
    const nueva     = !actual;
    _estadoActual.set(clave, nueva);
    _cambios.set(clave, nueva);

    // Actualizar celda visualmente
    celda.classList.toggle('ocupado', nueva);
    celda.setAttribute('aria-pressed', String(nueva));
    celda.innerHTML = nueva
      ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
      : '';
    celda.title = nueva
      ? 'Disponible en el liceo'
      : 'Marque como ocupado en otra institución';

    _actualizarContadorCambios();
  }

  /** Actualiza el contador del botón confirmar y lo habilita/deshabilita. */
  function _actualizarContadorCambios() {
    const nCambios = _cambios.size;
    const btn      = document.getElementById('disp-btn-confirmar');
    const cont     = document.getElementById('disp-cambios-count');

    if (btn) btn.disabled = nCambios === 0;
    if (cont) cont.textContent = nCambios > 0 ? `(${nCambios})` : '';
  }

  /** Guarda en la BD todos los cambios pendientes. */
  async function _confirmarGuardado() {
    if (_guardando || _cambios.size === 0) return;
    _guardando = true;

    const btn = document.getElementById('disp-btn-confirmar');
    btn?.classList.add('loading');
    btn && (btn.disabled = true);

    const total = _cambios.size;
    let guardados = 0;
    let errores = 0;

    try {
      for (const [clave, ocupado] of _cambios.entries()) {
        const [dia, numHora] = clave.split(':');
        const res = await fetch(`${URL_DISP()}/upsert`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            id_docente: _docenteId,
            dia_semana: Number(dia),
            numero_hora: Number(numHora),
            ocupado,
          }),
        });

        if (!res.ok) {
          errores++;
          continue;
        }
        guardados++;
      }

      if (errores > 0) {
        UI.mostrarToast(
          `Se guardaron ${guardados} de ${total} cambios. Algunos no se pudieron guardar.`,
          'warning'
        );
        // Recargar para forzar consistencia con la BD
        _cambios = new Map();
        await _cargarGrilla();
      } else {
        UI.mostrarToast(`Disponibilidad guardada correctamente (${total} cambios).`, 'success');
        _cambios = new Map();
        _actualizarContadorCambios();
      }
    } catch {
      UI.mostrarToast('No se pudo conectar con el servidor.', 'error');
    } finally {
      _guardando = false;
      btn?.classList.remove('loading');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

  /** Convierte 'HH:MM:SS' en 'HH:MM'. */
  function _formatearHora(hora) {
    if (!hora) return '';
    const partes = String(hora).split(':');
    return partes.length >= 2 ? `${partes[0]}:${partes[1]}` : hora;
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
    if (document.getElementById('style-modulo-disponibilidad')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-disponibilidad';
    style.textContent = `
      .disp-selector {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        padding: 1rem;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
      }

      .disp-ayuda {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin-top: 0.75rem;
      }

      .disp-acciones {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.5rem 0;
      }
      .disp-acciones .disp-ayuda { margin-top: 0; }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
