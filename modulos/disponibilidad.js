// ============================================================
// modulos/disponibilidad.js — Módulo Disponibilidad Docente
// Grillas semanales independientes por turno (Matutino, Vespertino, etc.)
// Un único desplegable para elegir docente. Cada turno cuenta con su
// propia grilla y botón independiente para guardar los cambios.
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css, css/horario.css
// ============================================================

window.Modulo_disponibilidad = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor       = null; // Elemento raíz
  let _docentes         = [];   // Lista de docentes
  let _turnos           = [];   // Lista de turnos disponibles en BD
  let _horariosPorTurno = new Map(); // id_turno → array de horas
  let _docenteId        = null; // Docente seleccionado actualmente

  // Mapas por turno: id_turno → Map("dia:numhora" → boolean)
  let _estadosPorTurno           = new Map();
  let _cambiosPorTurno           = new Map(); // id_turno → Map("dia:numhora" → boolean)
  let _asignacionesLiceoPorTurno = new Map(); // id_turno → Map("dia:numhora" → { grupo_nombre, asignatura_nombre, id_grupo, id_horario })

  let _guardandoTurnos  = new Set(); // IDs de turnos que se están guardando activamente

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_DOC  = () => `${App.API_BASE}/docentes`;
  const URL_TUR  = () => `${App.API_BASE}/turnos`;
  const URL_HOR  = () => `${App.API_BASE}/horarios_turno`;
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
    _docenteId  = null;
    _estadosPorTurno.clear();
    _cambiosPorTurno.clear();
    _asignacionesLiceoPorTurno.clear();
    _guardandoTurnos.clear();

    _contenedor.innerHTML = `
      <div class="disponibilidad-layout">

        ${UI.headerModulo(
          'Disponibilidad Docente',
          'Gestioná los horarios en los que cada docente está ocupado en otras instituciones'
        )}

        <!-- Selector único de docente y botones de exportación -->
        <div class="disp-selector-docente-box">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;">
            <div class="campo-grupo" style="flex:1;min-width:280px;max-width:540px;margin-bottom:0;">
              <label class="campo-label" for="disp-select-docente">
                <i class="fa-solid fa-user-check" style="color:var(--accent);margin-right:4px;"></i>
                Seleccionar Docente
              </label>
              <div class="select-wrapper">
                <i class="fa-solid fa-chalkboard-user input-icono-izq" aria-hidden="true"></i>
                <select id="disp-select-docente" class="campo-select">
                  <option value="">— Cargando lista de docentes... —</option>
                </select>
              </div>
              <span class="campo-ayuda">Elegí un docente para visualizar, editar y exportar sus horarios.</span>
            </div>

            <!-- Acciones de Exportación (Fase 8) -->
            <div class="disp-exportar-acciones" style="display:flex;gap:0.75rem;align-items:center;padding-bottom:4px;">
              <button class="btn btn-secondary btn-sm" id="disp-btn-exportar-xlsx" disabled title="Exportar horario del docente a Excel / Google Sheets">
                <i class="fa-solid fa-file-excel" style="color:#22c55e;" aria-hidden="true"></i>
                Exportar Excel
              </button>
              <button class="btn btn-secondary btn-sm" id="disp-btn-exportar-pdf" disabled title="Imprimir o guardar en PDF el horario del docente">
                <i class="fa-solid fa-file-pdf" style="color:#ef4444;" aria-hidden="true"></i>
                Imprimir / PDF
              </button>
            </div>
          </div>
        </div>

        <!-- Leyenda de colores -->
        <div class="leyenda-colores">
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-vacio"></span> <strong>Disponible en el liceo</strong> (Libre para asignar)
          </span>
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-ext"></span> <strong>No disponible</strong> (Ocupado en otra institución)
          </span>
          <span class="leyenda-item">
            <span class="leyenda-dot leyenda-dot-liceo"></span> <strong>Clase en el liceo</strong> (Asignado en Armar Horarios)
          </span>
        </div>

        <!-- Contenedor dinámico de turnos -->
        <div id="disp-turnos-wrap"></div>

      </div>
    `;

    document.getElementById('disp-select-docente')
      ?.addEventListener('change', _manejarCambioDocente);

    // Botones de exportación (Fase 8)
    document.getElementById('disp-btn-exportar-xlsx')
      ?.addEventListener('click', _exportarDocenteExcel);

    document.getElementById('disp-btn-exportar-pdf')
      ?.addEventListener('click', _imprimirHorarioDocente);

    await _cargarDatosIniciales();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA INICIAL DE DATOS BASE
  // ════════════════════════════════════════════════════════════

  async function _cargarDatosIniciales() {
    const wrap = document.getElementById('disp-turnos-wrap');
    if (!wrap) return;

    UI.mostrarCargando(wrap, 'Cargando docentes y configuración de turnos...');

    try {
      const [rDoc, rTur, rHor] = await Promise.all([
        fetch(URL_DOC()),
        fetch(URL_TUR()),
        fetch(URL_HOR()),
      ]);

      if (!rDoc.ok || !rTur.ok || !rHor.ok) {
        throw new Error('Error al conectar con la base de datos');
      }

      _docentes = await rDoc.json();
      _turnos   = await rTur.json();
      const todosHorarios = await rHor.json();

      // Organizar horarios por id_turno
      _horariosPorTurno.clear();
      _turnos.forEach(t => _horariosPorTurno.set(t.id, []));
      todosHorarios.forEach(h => {
        if (_horariosPorTurno.has(h.id_turno)) {
          _horariosPorTurno.get(h.id_turno).push(h);
        }
      });

      // Ordenar horas de cada turno por numero_hora
      for (const [idTur, lista] of _horariosPorTurno.entries()) {
        lista.sort((a, b) => a.numero_hora - b.numero_hora);
      }

      _poblarSelectDocente();

      // Mostrar estado vacío inicial hasta seleccionar un docente
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-calendar-check',
        'Seleccioná un docente',
        'Elegí un docente del desplegable superior para ver sus grillas de horarios matutino y vespertino.'
      );

    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo cargar la información',
        UI.mensajeError(error)
      );
    }
  }

  function _poblarSelectDocente() {
    const sel = document.getElementById('disp-select-docente');
    if (!sel) return;

    if (_docentes.length === 0) {
      sel.innerHTML = '<option value="">— No hay docentes registrados en la base de datos —</option>';
      return;
    }

    sel.innerHTML = '<option value="">— Seleccioná un docente —</option>' +
      _docentes.map(d =>
        `<option value="${d.id}">${_esc(d.apellido)}, ${_esc(d.nombre)} (C.I. ${_esc(d.cedula || 'S/D')})</option>`
      ).join('');
  }

  // ════════════════════════════════════════════════════════════
  //  MANEJO DE CAMBIO DE DOCENTE (con detección de cambios)
  // ════════════════════════════════════════════════════════════

  function _hayCambiosPendientes() {
    let total = 0;
    for (const cambios of _cambiosPorTurno.values()) {
      total += cambios.size;
    }
    return total > 0;
  }

  function _manejarCambioDocente(e) {
    const nuevoId = Number(e.target.value) || null;

    if (_hayCambiosPendientes()) {
      _preguntarCambiosPendientes(
        async () => {
          // Confirmar guardado de todos los turnos pendientes antes de cambiar
          await _guardarTodosLosTurnos();
          _docenteId = nuevoId;
          _cargarDisponibilidadDocente();
        },
        () => {
          // Descartar cambios
          _cambiosPorTurno.clear();
          _docenteId = nuevoId;
          _cargarDisponibilidadDocente();
        },
        () => {
          // Cancelar: revertir selección
          const sel = document.getElementById('disp-select-docente');
          if (sel) sel.value = _docenteId ? String(_docenteId) : '';
        }
      );
    } else {
      _docenteId = nuevoId;
      _cargarDisponibilidadDocente();
    }
  }

  function _preguntarCambiosPendientes(onGuardar, onDescartar, onCancelar) {
    let total = 0;
    for (const c of _cambiosPorTurno.values()) total += c.size;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:.65rem;">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);font-size:1.2rem;" aria-hidden="true"></i>
            <span class="modal-titulo">Cambios pendientes sin guardar</span>
          </div>
          <button class="modal-cerrar" id="modal-disp-cerrar" aria-label="Cerrar modal">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:var(--text-base);color:var(--text-muted);line-height:1.7;">
            Tenés <strong style="color:var(--text)">${total} cambio${total > 1 ? 's' : ''}</strong> sin guardar en la disponibilidad del docente actual. ¿Qué deseás hacer antes de cambiar?
          </p>
        </div>
        <div class="modal-footer" style="gap:.5rem;justify-content:flex-end;">
          <button class="btn btn-secondary" id="modal-disp-cancelar">Cancelar</button>
          <button class="btn btn-danger" id="modal-disp-descartar">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            Descartar cambios
          </button>
          <button class="btn btn-primary" id="modal-disp-guardar">
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            Guardar y continuar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.querySelector('#modal-disp-guardar')?.focus());

    const cerrar = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.18s ease';
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#modal-disp-guardar')?.addEventListener('click', async () => {
      cerrar();
      await onGuardar();
    });

    overlay.querySelector('#modal-disp-descartar')?.addEventListener('click', () => {
      cerrar();
      onDescartar();
    });

    overlay.querySelector('#modal-disp-cancelar')?.addEventListener('click', () => {
      cerrar();
      onCancelar();
    });

    overlay.querySelector('#modal-disp-cerrar')?.addEventListener('click', () => {
      cerrar();
      onCancelar();
    });
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA Y RENDERIZADO DE GRILLAS POR TURNO
  // ════════════════════════════════════════════════════════════

  async function _cargarDisponibilidadDocente() {
    const wrap = document.getElementById('disp-turnos-wrap');
    if (!wrap) return;

    if (!_docenteId) {
      _actualizarEstadoBotonesExportar(false);
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-calendar-check',
        'Seleccioná un docente',
        'Elegí un docente del desplegable superior para ver sus grillas de horarios matutino y vespertino.'
      );
      return;
    }

    _actualizarEstadoBotonesExportar(false);
    UI.mostrarCargando(wrap, 'Cargando disponibilidad del docente...');

    try {
      const res = await fetch(`${URL_DISP()}/completa_docente/${_docenteId}`);
      if (!res.ok) throw new Error('Error al obtener la disponibilidad');
      const { externos, internos } = await res.json();

      // Inicializar mapas de estado para cada turno
      _estadosPorTurno.clear();
      _cambiosPorTurno.clear();
      _asignacionesLiceoPorTurno.clear();

      _turnos.forEach(t => {
        _estadosPorTurno.set(t.id, new Map());
        _cambiosPorTurno.set(t.id, new Map());
        _asignacionesLiceoPorTurno.set(t.id, new Map());
      });

      // Rellenar estado de ocupación externa (otras instituciones)
      (externos || []).forEach(reg => {
        const idTurno = reg.id_turno || (_turnos[0]?.id);
        if (_estadosPorTurno.has(idTurno)) {
          _estadosPorTurno.get(idTurno).set(`${reg.dia_semana}:${reg.numero_hora}`, reg.ocupado === true);
        }
      });

      // Rellenar estado de ocupación interna (clases asignadas en este liceo)
      (internos || []).forEach(reg => {
        const idTurno = reg.id_turno || (_turnos[0]?.id);
        if (_asignacionesLiceoPorTurno.has(idTurno)) {
          _asignacionesLiceoPorTurno.get(idTurno).set(`${reg.dia_semana}:${reg.numero_hora}`, {
            grupo_nombre: reg.grupo_nombre,
            asignatura_nombre: reg.asignatura_nombre,
            id_grupo: reg.id_grupo,
            id_horario: reg.id_horario
          });
        }
      });

      _renderizarContenedorTurnos();
      _actualizarEstadoBotonesExportar(true);

    } catch (error) {
      _actualizarEstadoBotonesExportar(false);
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'Error al cargar disponibilidad',
        UI.mensajeError(error)
      );
    }
  }

  function _actualizarEstadoBotonesExportar(habilitado) {
    const btnXlsx = document.getElementById('disp-btn-exportar-xlsx');
    const btnPdf  = document.getElementById('disp-btn-exportar-pdf');
    if (btnXlsx) btnXlsx.disabled = !habilitado;
    if (btnPdf)  btnPdf.disabled  = !habilitado;
  }

  /**
   * Renderiza los recuadros de cada turno en orden (Matutino primero, Vespertino segundo, etc.)
   */
  function _renderizarContenedorTurnos() {
    const wrap = document.getElementById('disp-turnos-wrap');
    if (!wrap) return;

    if (_turnos.length === 0) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-clock',
        'No hay turnos configurados',
        'Cargá los turnos del liceo en el módulo "Turnos y Horarios".'
      );
      return;
    }

    // Ordenar turnos poniendo Matutino primero, luego Vespertino, luego otros
    const turnosOrdenados = [..._turnos].sort((a, b) => {
      const nomA = a.nombre.toLowerCase();
      const nomB = b.nombre.toLowerCase();
      if (nomA.includes('matutino')) return -1;
      if (nomB.includes('matutino')) return 1;
      if (nomA.includes('vespertino')) return -1;
      if (nomB.includes('vespertino')) return 1;
      return a.id - b.id;
    });

    const docenteActual = _docentes.find(d => d.id === _docenteId);
    const nombreDocente = docenteActual ? `${docenteActual.nombre} ${docenteActual.apellido}` : 'Docente';

    wrap.innerHTML = `
      <div class="disp-turnos-container">
        ${turnosOrdenados.map(t => _generarHTMLTurnoCard(t, nombreDocente)).join('')}
      </div>
    `;

    // Asignar listeners a cada recuadro de turno
    turnosOrdenados.forEach(t => {
      _asociarEventosTurnoCard(t.id);
    });
  }

  /**
   * Genera el HTML de una tarjeta de turno completa
   */
  function _generarHTMLTurnoCard(turno, nombreDocente) {
    const horas = _horariosPorTurno.get(turno.id) || [];
    const nomLower = turno.nombre.toLowerCase();

    // Determinar icono y clase visual según el tipo de turno
    let iconoClase = 'fa-solid fa-sun';
    let estiloIcono = 'matutino';
    if (nomLower.includes('vespertino') || nomLower.includes('tarde')) {
      iconoClase = 'fa-solid fa-cloud-sun';
      estiloIcono = 'vespertino';
    } else if (nomLower.includes('nocturno') || nomLower.includes('noche')) {
      iconoClase = 'fa-solid fa-moon';
      estiloIcono = 'nocturno';
    }

    // Rango horario global del turno
    let rangoTexto = '';
    if (horas.length > 0) {
      const inicio = _formatearHora(horas[0].hora_inicio);
      const fin = _formatearHora(horas[horas.length - 1].hora_fin);
      rangoTexto = `${inicio} – ${fin} · ${horas.length} ${horas.length === 1 ? 'hora' : 'horas'} de clase`;
    } else {
      rangoTexto = 'Sin horas configuradas';
    }

    const cambiosTurno = _cambiosPorTurno.get(turno.id)?.size || 0;
    const estadoTurno = _estadosPorTurno.get(turno.id);
    const asigsLiceoTurno = _asignacionesLiceoPorTurno.get(turno.id) || new Map();

    // Si el turno no tiene horas configuradas
    if (horas.length === 0) {
      return `
        <div class="disp-turno-card" id="disp-card-turno-${turno.id}">
          <div class="disp-turno-header">
            <div class="disp-turno-info">
              <div class="disp-turno-icono ${estiloIcono}">
                <i class="${iconoClase}" aria-hidden="true"></i>
              </div>
              <div>
                <h3 class="disp-turno-titulo">${_esc(turno.nombre)}</h3>
                <span class="disp-turno-rango">${rangoTexto}</span>
              </div>
            </div>
          </div>
          <div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">
            <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;color:var(--warning);margin-bottom:.5rem;display:block;"></i>
            Este turno no posee horas configuradas en el sistema.
          </div>
        </div>
      `;
    }

    // Cabecera de la tabla (Lunes a Viernes)
    const theadHTML = `
      <tr>
        <th style="width:130px;">Horas</th>
        ${DIAS.map(d => `<th>${_esc(d.nombre)}</th>`).join('')}
      </tr>
    `;

    // Filas de horas del turno
    const tbodyHTML = horas.map(h => {
      const etiqueta = `Hora ${h.numero_hora}`;
      const rango    = `${_formatearHora(h.hora_inicio)} – ${_formatearHora(h.hora_fin)}`;

      const celdas = DIAS.map(d => {
        const clave     = `${d.id}:${h.numero_hora}`;
        const asigLiceo = asigsLiceoTurno.get(clave);
        const ocupado   = estadoTurno ? estadoTurno.get(clave) === true : false;

        if (asigLiceo) {
          const infoMateria = asigLiceo.asignatura_nombre ? ` (${asigLiceo.asignatura_nombre})` : '';
          return `
            <td>
              <button
                type="button"
                class="disp-celda ocupado-liceo"
                data-turno="${turno.id}"
                data-dia="${d.id}"
                data-numhora="${h.numero_hora}"
                data-tipo="liceo"
                title="Clase asignada en el liceo: Grupo ${_esc(asigLiceo.grupo_nombre)}${_esc(infoMateria)} — Gestionado en Armar Horarios"
                aria-label="${_esc(d.nombre)} hora ${h.numero_hora} clase asignada en liceo grupo ${_esc(asigLiceo.grupo_nombre)}"
              >
                <span class="disp-badge-grupo">
                  <span class="disp-badge-grupo-nombre">${_esc(asigLiceo.grupo_nombre)}</span>
                  <i class="fa-solid fa-school disp-badge-grupo-icono" aria-hidden="true"></i>
                </span>
              </button>
            </td>
          `;
        }

        return `
          <td>
            <button
              type="button"
              class="disp-celda ${ocupado ? 'ocupado' : ''}"
              data-turno="${turno.id}"
              data-dia="${d.id}"
              data-numhora="${h.numero_hora}"
              data-tipo="externo"
              title="${ocupado ? 'No disponible (ocupado en otra institución) — Clic para marcar como disponible' : 'Disponible en liceo — Clic para marcar como ocupado'}"
              aria-label="${_esc(d.nombre)} hora ${h.numero_hora} ${ocupado ? 'no disponible' : 'disponible'}"
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
            <div style="display:flex;flex-direction:column;line-height:1.25;">
              <span style="color:var(--text);font-weight:700;font-size:var(--text-xs);">${_esc(etiqueta)}</span>
              <span style="font-size:0.7rem;color:var(--text-muted);">${rango}</span>
            </div>
          </td>
          ${celdas}
        </tr>
      `;
    }).join('');

    return `
      <div class="disp-turno-card" id="disp-card-turno-${turno.id}">
        
        <!-- Cabecera del Turno -->
        <div class="disp-turno-header">
          <div class="disp-turno-info">
            <div class="disp-turno-icono ${estiloIcono}">
              <i class="${iconoClase}" aria-hidden="true"></i>
            </div>
            <div>
              <h3 class="disp-turno-titulo">
                ${_esc(turno.nombre)}
                <span class="disp-badge-cambios" id="disp-badge-turno-${turno.id}" style="${cambiosTurno > 0 ? '' : 'display:none;'}">
                  ${cambiosTurno} cambio${cambiosTurno > 1 ? 's' : ''} pendiente${cambiosTurno > 1 ? 's' : ''}
                </span>
              </h3>
              <span class="disp-turno-rango">${rangoTexto}</span>
            </div>
          </div>

          <!-- Acciones rápidas -->
          <div class="disp-turno-header-actions">
            <button type="button" class="btn-mini" id="disp-btn-marcar-todos-${turno.id}" title="Marcar todas las horas del turno como ocupadas">
              <i class="fa-solid fa-xmark" style="color:var(--error)" aria-hidden="true"></i>
              Marcar todo ocupado
            </button>
            <button type="button" class="btn-mini" id="disp-btn-limpiar-todos-${turno.id}" title="Marcar todas las horas del turno como disponibles">
              <i class="fa-solid fa-check" style="color:var(--success)" aria-hidden="true"></i>
              Marcar todo disponible
            </button>
          </div>
        </div>

        <!-- Grilla semanal -->
        <div class="disponibilidad-tabla-wrap" style="border:none;border-radius:0;">
          <table class="tabla-disponibilidad">
            <thead>${theadHTML}</thead>
            <tbody>${tbodyHTML}</tbody>
          </table>
        </div>

        <!-- Pie del Turno con botón de guardado independiente -->
        <div class="disp-turno-footer">
          <p class="disp-ayuda" style="margin:0;">
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            Hacé clic en los casilleros para marcar las horas en que <strong>${_esc(nombreDocente)}</strong> NO puede dar clases en el <strong>${_esc(turno.nombre)}</strong>.
          </p>

          <button
            type="button"
            class="btn btn-primary"
            id="disp-btn-guardar-${turno.id}"
            ${cambiosTurno === 0 ? 'disabled' : ''}
          >
            <span class="btn-text">
              <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
              Guardar disponibilidad ${turno.nombre} <span id="disp-btn-count-${turno.id}">${cambiosTurno > 0 ? `(${cambiosTurno})` : ''}</span>
            </span>
            <div class="btn-spinner" aria-hidden="true"></div>
          </button>
        </div>

      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  INTERACCIÓN CON CELDAS Y BOTONES DE CADA RECUADRO
  // ════════════════════════════════════════════════════════════

  function _asociarEventosTurnoCard(idTurno) {
    const card = document.getElementById(`disp-card-turno-${idTurno}`);
    if (!card) return;

    // Clic en celdas de la grilla
    card.addEventListener('click', (e) => {
      const celda = e.target.closest('.disp-celda');
      if (celda && celda.dataset.turno === String(idTurno)) {
        _alternarCelda(celda, idTurno);
      }
    });

    // Botón Guardar del turno
    const btnGuardar = document.getElementById(`disp-btn-guardar-${idTurno}`);
    btnGuardar?.addEventListener('click', () => _guardarTurno(idTurno));

    // Acciones rápidas
    document.getElementById(`disp-btn-marcar-todos-${idTurno}`)
      ?.addEventListener('click', () => _marcarTodos(idTurno, true));

    document.getElementById(`disp-btn-limpiar-todos-${idTurno}`)
      ?.addEventListener('click', () => _marcarTodos(idTurno, false));
  }

  function _alternarCelda(celda, idTurno) {
    if (_guardandoTurnos.has(idTurno)) return;

    const dia     = Number(celda.dataset.dia);
    const numHora = Number(celda.dataset.numhora);
    const clave   = `${dia}:${numHora}`;

    const asigLiceo = _asignacionesLiceoPorTurno.get(idTurno)?.get(clave);
    if (asigLiceo || celda.classList.contains('ocupado-liceo')) {
      const nomGrup = asigLiceo?.grupo_nombre ? `al grupo ${asigLiceo.grupo_nombre}` : 'a un grupo del liceo';
      const nomAsig = asigLiceo?.asignatura_nombre ? ` (${asigLiceo.asignatura_nombre})` : '';
      UI.mostrarToast(`Esta hora está asignada ${nomGrup}${nomAsig}. Para modificarla, hacelo desde el módulo "Armar Horarios".`, 'info');
      return;
    }

    const estadoTurno  = _estadosPorTurno.get(idTurno);
    const cambiosTurno = _cambiosPorTurno.get(idTurno);

    if (!estadoTurno || !cambiosTurno) return;

    const ocupadoActual = estadoTurno.get(clave) === true;
    const nuevoOcupado  = !ocupadoActual;

    estadoTurno.set(clave, nuevoOcupado);
    cambiosTurno.set(clave, nuevoOcupado);

    // Actualizar visualmente la celda
    celda.classList.toggle('ocupado', nuevoOcupado);
    celda.setAttribute('aria-pressed', String(nuevoOcupado));
    celda.innerHTML = nuevoOcupado
      ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
      : '';
    celda.title = nuevoOcupado
      ? 'No disponible (ocupado en otra institución) — Clic para marcar como disponible'
      : 'Disponible en liceo — Clic para marcar como ocupado';

    _actualizarEstadoBotonTurno(idTurno);
  }

  function _marcarTodos(idTurno, marcarOcupado) {
    if (_guardandoTurnos.has(idTurno)) return;

    const horas        = _horariosPorTurno.get(idTurno) || [];
    const estadoTurno  = _estadosPorTurno.get(idTurno);
    const cambiosTurno = _cambiosPorTurno.get(idTurno);
    const asigsLiceo   = _asignacionesLiceoPorTurno.get(idTurno) || new Map();
    const card         = document.getElementById(`disp-card-turno-${idTurno}`);

    if (!estadoTurno || !cambiosTurno || !card) return;

    horas.forEach(h => {
      DIAS.forEach(d => {
        const clave = `${d.id}:${h.numero_hora}`;
        // Omitir si la celda tiene una clase asignada en el liceo
        if (asigsLiceo.has(clave)) return;

        const actual = estadoTurno.get(clave) === true;
        if (actual !== marcarOcupado) {
          estadoTurno.set(clave, marcarOcupado);
          cambiosTurno.set(clave, marcarOcupado);
        }
      });
    });

    // Actualizar todas las celdas del card excepto las asignadas en liceo
    card.querySelectorAll('.disp-celda:not(.ocupado-liceo)').forEach(celda => {
      celda.classList.toggle('ocupado', marcarOcupado);
      celda.setAttribute('aria-pressed', String(marcarOcupado));
      celda.innerHTML = marcarOcupado
        ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
        : '';
      celda.title = marcarOcupado
        ? 'No disponible (ocupado en otra institución) — Clic para marcar como disponible'
        : 'Disponible en liceo — Clic para marcar como ocupado';
    });

    _actualizarEstadoBotonTurno(idTurno);
  }

  function _actualizarEstadoBotonTurno(idTurno) {
    const cambiosTurno = _cambiosPorTurno.get(idTurno);
    const total = cambiosTurno ? cambiosTurno.size : 0;

    const btn = document.getElementById(`disp-btn-guardar-${idTurno}`);
    const count = document.getElementById(`disp-btn-count-${idTurno}`);
    const badge = document.getElementById(`disp-badge-turno-${idTurno}`);

    if (btn) btn.disabled = total === 0;
    if (count) count.textContent = total > 0 ? `(${total})` : '';

    if (badge) {
      if (total > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = `${total} cambio${total > 1 ? 's' : ''} pendiente${total > 1 ? 's' : ''}`;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  GUARDADO EN BASE DE DATOS
  // ════════════════════════════════════════════════════════════

  /**
   * Guarda de forma atómica e independiente los cambios de un único turno.
   */
  async function _guardarTurno(idTurno) {
    if (_guardandoTurnos.has(idTurno) || !_docenteId) return;

    const cambios = _cambiosPorTurno.get(idTurno);
    if (!cambios || cambios.size === 0) return;

    const turnoObj = _turnos.find(t => t.id === idTurno);
    const nombreTurno = turnoObj ? turnoObj.nombre : 'Turno';

    _guardandoTurnos.add(idTurno);
    const btn = document.getElementById(`disp-btn-guardar-${idTurno}`);
    btn?.classList.add('loading');
    if (btn) btn.disabled = true;

    const listaCambios = [];
    for (const [clave, ocupado] of cambios.entries()) {
      const [dia, numHora] = clave.split(':');
      listaCambios.push({
        dia_semana:  Number(dia),
        numero_hora: Number(numHora),
        ocupado:     Boolean(ocupado)
      });
    }

    try {
      const res = await fetch(`${URL_DISP()}/guardar_turno`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id_docente: _docenteId,
          id_turno:   idTurno,
          cambios:    listaCambios
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || 'Error en el servidor al guardar la disponibilidad');
      }

      cambios.clear();
      _actualizarEstadoBotonTurno(idTurno);

      UI.mostrarToast(`Disponibilidad de ${nombreTurno} guardada correctamente (${listaCambios.length} cambios aplicados).`, 'success');

    } catch (error) {
      UI.mostrarToast(error.message || 'No se pudo conectar con el servidor', 'error');
    } finally {
      _guardandoTurnos.delete(idTurno);
      btn?.classList.remove('loading');
      _actualizarEstadoBotonTurno(idTurno);
    }
  }

  /**
   * Guarda todos los turnos que tengan cambios pendientes.
   */
  async function _guardarTodosLosTurnos() {
    for (const [idTurno, cambios] of _cambiosPorTurno.entries()) {
      if (cambios.size > 0) {
        await _guardarTurno(idTurno);
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  EXPORTACIÓN A EXCEL / GOOGLE SHEETS (FASE 8)
  // ════════════════════════════════════════════════════════════

  function _exportarDocenteExcel() {
    if (!_docenteId) {
      UI.mostrarToast('Seleccioná un docente primero para exportar.', 'warning');
      return;
    }

    if (typeof XLSX === 'undefined') {
      UI.mostrarToast('La librería de exportación no está disponible.', 'error');
      return;
    }

    try {
      const docente = _docentes.find(d => d.id === _docenteId);
      if (!docente) return;

      const wb = XLSX.utils.book_new();

      // Ordenar turnos: Matutino primero, luego Vespertino, etc.
      const turnosOrdenados = [..._turnos].sort((a, b) => {
        const nomA = a.nombre.toLowerCase();
        const nomB = b.nombre.toLowerCase();
        if (nomA.includes('matutino')) return -1;
        if (nomB.includes('matutino')) return 1;
        if (nomA.includes('vespertino')) return -1;
        if (nomB.includes('vespertino')) return 1;
        return a.id - b.id;
      });

      let turnosConHoras = 0;

      turnosOrdenados.forEach(turno => {
        const horas = _horariosPorTurno.get(turno.id) || [];
        if (horas.length === 0) return;

        turnosConHoras++;
        const estadoTurno     = _estadosPorTurno.get(turno.id);
        const asigsLiceoTurno = _asignacionesLiceoPorTurno.get(turno.id) || new Map();

        const filas = [];

        // Encabezados institucionales
        filas.push([`HORARIO DOCENTE — ${docente.apellido.toUpperCase()}, ${docente.nombre.toUpperCase()}`]);
        filas.push([`C.I.: ${docente.cedula || 'S/D'} | Turno: ${turno.nombre} | Emitido: ${new Date().toLocaleDateString('es-UY')}`]);
        filas.push([]);
        filas.push(['HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']);

        let totalHorasLiceo  = 0;
        let totalHorasExt    = 0;
        let totalHorasLibres = 0;

        horas.forEach(h => {
          const horaTexto = `${h.numero_hora}° (${_formatearHora(h.hora_inicio)} - ${_formatearHora(h.hora_fin)})`;
          const filaHora = [horaTexto];

          DIAS.forEach(d => {
            const clave     = `${d.id}:${h.numero_hora}`;
            const asigLiceo = asigsLiceoTurno.get(clave);
            const ocupado   = estadoTurno ? estadoTurno.get(clave) === true : false;

            if (asigLiceo) {
              totalHorasLiceo++;
              const infoMateria = asigLiceo.asignatura_nombre ? `\n${asigLiceo.asignatura_nombre}` : '';
              filaHora.push(`Clase Liceo: ${asigLiceo.grupo_nombre}${infoMateria}`);
            } else if (ocupado) {
              totalHorasExt++;
              filaHora.push('No disponible\n(Ocupado externo)');
            } else {
              totalHorasLibres++;
              filaHora.push('Disponible');
            }
          });

          filas.push(filaHora);
        });

        // Resumen al pie
        filas.push([]);
        filas.push(['RESUMEN DE HORAS:', `Clases en Liceo: ${totalHorasLiceo} hs`, `Ocupado Externo: ${totalHorasExt} hs`, `Disponibles: ${totalHorasLibres} hs`]);

        const ws = XLSX.utils.aoa_to_sheet(filas);

        // Anchos de columna óptimos para Google Sheets
        ws['!cols'] = [
          { wch: 22 }, // HORA
          { wch: 26 }, // LUNES
          { wch: 26 }, // MARTES
          { wch: 26 }, // MIÉRCOLES
          { wch: 26 }, // JUEVES
          { wch: 26 }  // VIERNES
        ];

        const nombreHoja = `${turno.nombre}`.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
        XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
      });

      if (turnosConHoras === 0) {
        UI.mostrarToast('No hay turnos con horas configuradas para exportar.', 'warning');
        return;
      }

      const nombreArchivo = `Horario_Docente_${docente.apellido.replace(/\s+/g, '_')}_${docente.nombre.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo);

      UI.mostrarToast(`Horario exportado como "${nombreArchivo}" con éxito.`, 'success');

    } catch (error) {
      console.error('Error al exportar horario a Excel:', error);
      UI.mostrarToast('Ocurrió un error al generar el archivo Excel.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  IMPRESIÓN / GENERACIÓN DE PDF
  // ════════════════════════════════════════════════════════════

  function _imprimirHorarioDocente() {
    if (!_docenteId) {
      UI.mostrarToast('Seleccioná un docente primero para imprimir.', 'warning');
      return;
    }

    try {
      const docente = _docentes.find(d => d.id === _docenteId);
      if (!docente) return;

      const turnosOrdenados = [..._turnos].sort((a, b) => {
        const nomA = a.nombre.toLowerCase();
        const nomB = b.nombre.toLowerCase();
        if (nomA.includes('matutino')) return -1;
        if (nomB.includes('matutino')) return 1;
        if (nomA.includes('vespertino')) return -1;
        if (nomB.includes('vespertino')) return 1;
        return a.id - b.id;
      });

      let tablasHTML = '';
      let totalGlobalLiceo = 0;
      let totalGlobalExt = 0;

      turnosOrdenados.forEach(turno => {
        const horas = _horariosPorTurno.get(turno.id) || [];
        if (horas.length === 0) return;

        const estadoTurno     = _estadosPorTurno.get(turno.id);
        const asigsLiceoTurno = _asignacionesLiceoPorTurno.get(turno.id) || new Map();

        const thead = `
          <tr>
            <th style="width:16%;">Hora</th>
            ${DIAS.map(d => `<th>${_esc(d.nombre)}</th>`).join('')}
          </tr>
        `;

        let totalTurnoLiceo = 0;
        let totalTurnoExt   = 0;

        const tbody = horas.map(h => {
          const etiqueta = `Hora ${h.numero_hora}`;
          const rango    = `${_formatearHora(h.hora_inicio)} - ${_formatearHora(h.hora_fin)}`;

          const celdas = DIAS.map(d => {
            const clave     = `${d.id}:${h.numero_hora}`;
            const asigLiceo = asigsLiceoTurno.get(clave);
            const ocupado   = estadoTurno ? estadoTurno.get(clave) === true : false;

            if (asigLiceo) {
              totalTurnoLiceo++;
              totalGlobalLiceo++;
              return `
                <td class="celda-liceo">
                  <strong>Grupo ${_esc(asigLiceo.grupo_nombre)}</strong>
                  ${asigLiceo.asignatura_nombre ? `<br><span style="font-size:8.5pt;">${_esc(asigLiceo.asignatura_nombre)}</span>` : ''}
                </td>
              `;
            }

            if (ocupado) {
              totalTurnoExt++;
              totalGlobalExt++;
              return `
                <td class="celda-externo">
                  <span>No disponible</span>
                  <br><span style="font-size:7.5pt;opacity:0.85;">(Otra instit.)</span>
                </td>
              `;
            }

            return `<td class="celda-libre">Disponible</td>`;
          }).join('');

          return `
            <tr>
              <td class="col-hora">
                <strong>${_esc(etiqueta)}</strong>
                <br><span style="font-size:8pt;color:#64748b;">${rango}</span>
              </td>
              ${celdas}
            </tr>
          `;
        }).join('');

        tablasHTML += `
          <div class="print-turno-box">
            <h3 class="print-turno-titulo">
              Turno ${_esc(turno.nombre)}
              <span style="float:right;font-size:8.5pt;font-weight:normal;color:#475569;">
                Clases Liceo: <strong>${totalTurnoLiceo} hs</strong> | No Disponible: <strong>${totalTurnoExt} hs</strong>
              </span>
            </h3>
            <table>
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
        `;
      });

      const ventanaImpresion = window.open('', '_blank');
      if (!ventanaImpresion) {
        UI.mostrarToast('El navegador bloqueó la ventana de impresión. Habilitá las ventanas emergentes.', 'error');
        return;
      }

      ventanaImpresion.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Horario — ${_esc(docente.apellido)}, ${_esc(docente.nombre)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 10pt;
      line-height: 1.3;
    }
    .print-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .print-title {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 3px 0;
      color: #0f172a;
    }
    .print-sub {
      font-size: 9pt;
      color: #475569;
      margin: 0;
    }
    .print-docente-info {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 9.5pt;
    }
    .print-docente-nombre {
      font-weight: 700;
      color: #1e293b;
    }
    .print-turno-box {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .print-turno-titulo {
      font-size: 10.5pt;
      font-weight: 700;
      background: #f1f5f9;
      padding: 5px 10px;
      border-left: 4px solid #4f46e5;
      margin: 0 0 6px 0;
      border-radius: 0 4px 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.03em;
    }
    .col-hora {
      font-weight: 600;
      width: 17%;
      background: #f8fafc;
      text-align: left;
    }
    .celda-liceo {
      background: #eef2ff !important;
      color: #3730a3 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .celda-externo {
      background: #fef2f2 !important;
      color: #991b1b !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .celda-libre {
      color: #64748b;
    }
    .print-firmas {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      padding: 0 40px;
      font-size: 9pt;
      text-align: center;
      page-break-inside: avoid;
    }
    .linea-firma {
      width: 180px;
      border-top: 1px solid #64748b;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <h1 class="print-title">PLANILLA DE HORARIO Y DISPONIBILIDAD DOCENTE</h1>
      <p class="print-sub">Sistema de Gestión Académica y Horarios</p>
    </div>
    <div style="text-align:right;font-size:8.5pt;color:#64748b;">
      Emitido el ${new Date().toLocaleDateString('es-UY')}
    </div>
  </div>

  <div class="print-docente-info">
    <div>Docente: <span class="print-docente-nombre">${_esc(docente.apellido)}, ${_esc(docente.nombre)}</span></div>
    <div>C.I.: <strong>${_esc(docente.cedula || 'S/D')}</strong></div>
    <div>Total Clases Liceo: <strong>${totalGlobalLiceo} hs</strong></div>
  </div>

  ${tablasHTML}

  <div class="print-firmas">
    <div>
      <div class="linea-firma"></div>
      <span>Firma del Docente</span>
    </div>
    <div>
      <div class="linea-firma"></div>
      <span>Firma Dirección / Administración</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  <\/script>
</body>
</html>`);
      ventanaImpresion.document.close();

    } catch (error) {
      console.error('Error al generar vista de impresión:', error);
      UI.mostrarToast('Ocurrió un error al preparar la impresión.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

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

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
