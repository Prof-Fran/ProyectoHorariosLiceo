// ============================================================
// js/consulta_disponibilidad.js
// Lógica para la vista de consulta de disponibilidad multidocente
// Permite evaluar en tiempo real los horarios de todos los docentes de un grupo
// ============================================================

(() => {
  let _idGrupo = null;
  let _datos = null; // { grupo, turnos, horarios, docentes }
  let _docenteSeleccionadoId = null;
  let _vistaActual = 'pestanas'; // 'pestanas' | 'mosaico'
  let _filtroTexto = '';
  let _turnoSeleccionadoId = null;

  const DIAS = [
    { id: 1, nombre: 'Lunes' },
    { id: 2, nombre: 'Martes' },
    { id: 3, nombre: 'Miércoles' },
    { id: 4, nombre: 'Jueves' },
    { id: 5, nombre: 'Viernes' },
  ];

  // ── Inicialización ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    _idGrupo = params.get('id_grupo');

    if (!_idGrupo) {
      _renderizarError('No se especificó ningún grupo para consultar.');
      return;
    }

    _bindEventosGenerales();
    await _cargarDatos();
  });

  function _bindEventosGenerales() {
    // Botón refrescar / actualizar
    document.getElementById('btn-actualizar')?.addEventListener('click', async () => {
      const icono = document.getElementById('icono-refrescar');
      icono?.classList.add('fa-spin');
      await _cargarDatos();
      setTimeout(() => icono?.classList.remove('fa-spin'), 400);
    });

    // Alternar modos de vista
    const btnPestanas = document.getElementById('btn-vista-pestanas');
    const btnMosaico  = document.getElementById('btn-vista-mosaico');

    btnPestanas?.addEventListener('click', () => {
      _vistaActual = 'pestanas';
      btnPestanas.classList.add('active');
      btnMosaico?.classList.remove('active');
      _renderizarContenido();
    });

    btnMosaico?.addEventListener('click', () => {
      _vistaActual = 'mosaico';
      btnMosaico.classList.add('active');
      btnPestanas?.classList.remove('active');
      _renderizarContenido();
    });

    // Buscador
    document.getElementById('filtro-docente-input')?.addEventListener('input', (e) => {
      _filtroTexto = e.target.value.toLowerCase().trim();
      _renderizarContenido();
    });
  }

  // ── Carga de Datos desde la API ──────────────────────────────
  async function _cargarDatos() {
    const contenedor = document.getElementById('consulta-contenedor');
    if (!contenedor) return;

    if (!_datos) {
      UI.mostrarCargando(contenedor, 'Cargando disponibilidades de los docentes...');
    }

    try {
      const res = await fetch(`${App.API_BASE}/disponibilidad/grupo_docentes/${_idGrupo}`);
      if (!res.ok) {
        throw new Error('Error al conectar con la base de datos');
      }

      _datos = await res.json();

      // Configurar turno inicial por defecto (el turno del grupo)
      if (!_turnoSeleccionadoId && _datos.grupo?.id_turno) {
        _turnoSeleccionadoId = _datos.grupo.id_turno;
      }

      // Configurar docente seleccionado por defecto
      if (!_docenteSeleccionadoId && _datos.docentes?.length > 0) {
        _docenteSeleccionadoId = _datos.docentes[0].id;
      }

      // Actualizar cabecera
      _actualizarCabecera();

      // Renderizar vista
      _renderizarContenido();

    } catch (error) {
      _renderizarError(error.message || 'No se pudieron obtener los datos');
    }
  }

  function _actualizarCabecera() {
    const elTitulo = document.getElementById('header-grupo-titulo');
    if (!elTitulo || !_datos?.grupo) return;

    const g = _datos.grupo;
    document.title = `Disponibilidad — Grupo ${g.nivel_nombre}${g.numero}`;
    elTitulo.innerHTML = `
      <span>${_esc(g.nivel_nombre)}${g.numero}</span>
      <span class="grupo-chip grupo-chip-nivel" style="font-size:0.75rem;">${_esc(g.nivel_nombre)}</span>
      <span class="grupo-chip grupo-chip-turno" style="font-size:0.75rem;">${_esc(g.turno_nombre)}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;margin-left:auto;">
        ${_datos.docentes.length} docente${_datos.docentes.length !== 1 ? 's' : ''} asignado${_datos.docentes.length !== 1 ? 's' : ''}
      </span>
    `;
  }

  // ── Renderizado según la vista activa ─────────────────────────
  function _renderizarContenido() {
    const contenedor = document.getElementById('consulta-contenedor');
    if (!contenedor || !_datos) return;

    const docentesFiltrados = _obtenerDocentesFiltrados();

    if (docentesFiltrados.length === 0) {
      contenedor.innerHTML = `
        <div class="estado-vacio" style="padding:4rem 1rem;">
          <i class="fa-solid fa-chalkboard-user" style="font-size:2.5rem;color:rgba(148,163,184,0.3);margin-bottom:1rem;" aria-hidden="true"></i>
          <h3>No hay docentes que coincidan</h3>
          <p>${_filtroTexto ? 'No se encontraron docentes con ese criterio de búsqueda.' : 'Este grupo aún no tiene docentes asignados.'}</p>
        </div>
      `;
      return;
    }

    if (_vistaActual === 'pestanas') {
      _renderizarVistaPestanas(contenedor, docentesFiltrados);
    } else {
      _renderizarVistaMosaico(contenedor, docentesFiltrados);
    }
  }

  function _obtenerDocentesFiltrados() {
    if (!_datos?.docentes) return [];
    if (!_filtroTexto) return _datos.docentes;

    return _datos.docentes.filter(d => {
      const nombreCompleto = `${d.nombre} ${d.apellido} ${d.apellido} ${d.nombre}`.toLowerCase();
      const materias = d.asignaturas.map(a => a.nombre).join(' ').toLowerCase();
      return nombreCompleto.includes(_filtroTexto) || materias.includes(_filtroTexto);
    });
  }

  // ════════════════════════════════════════════════════════════
  //  VISTA 1: PESTAÑAS (Detalle amplio del docente)
  // ════════════════════════════════════════════════════════════

  function _renderizarVistaPestanas(contenedor, docentes) {
    // Si el docente seleccionado no está en la lista filtrada, seleccionar el primero
    if (!docentes.some(d => d.id === _docenteSeleccionadoId)) {
      _docenteSeleccionadoId = docentes[0]?.id || null;
    }

    const docenteActual = docentes.find(d => d.id === _docenteSeleccionadoId) || docentes[0];

    const listadoDocentesHTML = docentes.map(d => {
      const isSelected = d.id === docenteActual?.id;
      const nombresMaterias = d.asignaturas.map(a => `${a.nombre} (${a.carga_horaria}h)`).join(', ');

      return `
        <button type="button" class="docente-tab-card ${isSelected ? 'active' : ''}" data-docente-id="${d.id}">
          <span class="docente-tab-nombre">${_esc(d.apellido)}, ${_esc(d.nombre)}</span>
          <span class="docente-tab-materia">${_esc(nombresMaterias)}</span>
        </button>
      `;
    }).join('');

    const grillaHTML = _generarHTMLGrillaDocente(docenteActual, _turnoSeleccionadoId);

    contenedor.innerHTML = `
      <div class="vista-pestanas-layout">
        
        <!-- Sidebar de lista de docentes -->
        <aside class="pestanas-sidebar">
          <div class="pestanas-sidebar-header">
            <span>Docentes del grupo (${docentes.length})</span>
            <i class="fa-solid fa-users" aria-hidden="true"></i>
          </div>
          <div class="pestanas-sidebar-list">
            ${listadoDocentesHTML}
          </div>
        </aside>

        <!-- Panel de Grilla del docente seleccionado -->
        <section class="pestanas-grilla-panel">
          ${_renderizarHeaderDocenteDetalle(docenteActual)}
          ${grillaHTML}
        </section>

      </div>
    `;

    // Eventos de selección de docente en sidebar
    contenedor.querySelectorAll('.docente-tab-card').forEach(btn => {
      btn.addEventListener('click', () => {
        _docenteSeleccionadoId = Number(btn.dataset.docenteId);
        _renderizarContenido();
      });
    });

    // Eventos de selector de turno (si hay más de 1 turno)
    contenedor.querySelectorAll('.disp-turno-selector-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _turnoSeleccionadoId = Number(btn.dataset.turnoId);
        _renderizarContenido();
      });
    });
  }

  function _renderizarHeaderDocenteDetalle(docente) {
    if (!docente) return '';

    const materiasHTML = docente.asignaturas.map(a =>
      `<span class="grupo-chip" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:var(--text-xs);">
        <i class="fa-solid fa-book" style="margin-right:4px;"></i>${_esc(a.nombre)} · ${a.carga_horaria}hs
      </span>`
    ).join('');

    // Selector de turno (Matutino / Vespertino / Nocturno)
    const turnosHTML = (_datos.turnos || []).map(t => {
      const isActive = t.id === _turnoSeleccionadoId;
      return `
        <button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'} disp-turno-selector-btn" data-turno-id="${t.id}">
          ${_esc(t.nombre)}
        </button>
      `;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-bottom:1px solid var(--glass-border);padding-bottom:1rem;">
        <div>
          <h2 style="font-size:1.15rem;font-weight:800;color:var(--text);margin:0 0 0.4rem 0;">
            ${_esc(docente.apellido)}, ${_esc(docente.nombre)}
          </h2>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
            ${materiasHTML}
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">
              C.I. ${_esc(docente.cedula || 'S/D')}
            </span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;margin-right:4px;">Turno:</span>
          ${turnosHTML}
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  VISTA 2: MOSAICO (Comparador de múltiples docentes)
  // ════════════════════════════════════════════════════════════

  function _renderizarVistaMosaico(contenedor, docentes) {
    const turnoActual = _datos.turnos.find(t => t.id === _turnoSeleccionadoId) || _datos.turnos[0];

    const turnosSelectorHTML = (_datos.turnos || []).map(t => {
      const isActive = t.id === _turnoSeleccionadoId;
      return `
        <button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'} disp-turno-selector-btn" data-turno-id="${t.id}">
          ${_esc(t.nombre)}
        </button>
      `;
    }).join('');

    const cardsHTML = docentes.map(doc => {
      const materiasTexto = doc.asignaturas.map(a => `${a.nombre} (${a.carga_horaria}h)`).join(', ');
      const grillaHTML = _generarHTMLGrillaDocente(doc, _turnoSeleccionadoId, true);

      return `
        <div class="mosaico-card">
          <div class="mosaico-card-header">
            <div>
              <h3 class="mosaico-docente-nombre">${_esc(doc.apellido)}, ${_esc(doc.nombre)}</h3>
              <span class="mosaico-docente-materia">${_esc(materiasTexto)}</span>
            </div>
            <span style="font-size:0.7rem;color:var(--text-muted);">C.I. ${_esc(doc.cedula || 'S/D')}</span>
          </div>
          <div style="overflow-x:auto;">
            ${grillaHTML}
          </div>
        </div>
      `;
    }).join('');

    contenedor.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-sm);flex-wrap:wrap;gap:0.5rem;">
          <span style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;">
            Mostrando disponibilidad en turno: <strong style="color:var(--text);">${_esc(turnoActual?.nombre || '')}</strong>
          </span>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            ${turnosSelectorHTML}
          </div>
        </div>

        <div class="vista-mosaico-layout">
          ${cardsHTML}
        </div>
      </div>
    `;

    // Eventos selector de turno
    contenedor.querySelectorAll('.disp-turno-selector-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _turnoSeleccionadoId = Number(btn.dataset.turnoId);
        _renderizarContenido();
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  //  GENERACIÓN DE GRILLA SEMANAL DE UN DOCENTE
  // ════════════════════════════════════════════════════════════

  function _generarHTMLGrillaDocente(docente, idTurno, compacta = false) {
    if (!docente || !idTurno) return '<p>Sin datos</p>';

    const horasTurno = (_datos.horarios || [])
      .filter(h => h.id_turno === idTurno)
      .sort((a, b) => a.numero_hora - b.numero_hora);

    if (horasTurno.length === 0) {
      return `
        <div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">
          <i class="fa-solid fa-clock" style="margin-bottom:0.5rem;display:block;font-size:1.5rem;color:var(--warning);"></i>
          Este turno no posee horas configuradas.
        </div>
      `;
    }

    // Mapear ocupaciones externas
    const mapExternos = new Map();
    (docente.externos || [])
      .filter(e => e.id_turno === idTurno)
      .forEach(e => mapExternos.set(`${e.dia_semana}:${e.numero_hora}`, true));

    // Mapear ocupaciones internas en el liceo
    const mapInternos = new Map();
    (docente.internos || [])
      .filter(i => i.id_turno === idTurno)
      .forEach(i => mapInternos.set(`${i.dia_semana}:${i.numero_hora}`, i));

    const theadHTML = `
      <tr>
        <th style="width:${compacta ? '80px' : '110px'};">Hora</th>
        ${DIAS.map(d => `<th>${_esc(compacta ? d.nombre.slice(0, 3) : d.nombre)}</th>`).join('')}
      </tr>
    `;

    const tbodyHTML = horasTurno.map(h => {
      const etiqueta = `Hora ${h.numero_hora}`;
      const rango = `${_formatearHora(h.hora_inicio)} – ${_formatearHora(h.hora_fin)}`;

      const celdas = DIAS.map(d => {
        const clave = `${d.id}:${h.numero_hora}`;
        const asigInterna = mapInternos.get(clave);
        const ocupadoExterno = mapExternos.get(clave) === true;

        if (asigInterna) {
          const infoMateria = asigInterna.asignatura_nombre ? ` (${asigInterna.asignatura_nombre})` : '';
          return `
            <td>
              <div
                class="disp-celda ocupado-liceo"
                title="Clase asignada en el liceo: Grupo ${_esc(asigInterna.grupo_nombre)}${_esc(infoMateria)}"
                style="cursor:default;${compacta ? 'width:30px;height:30px;font-size:0.65rem;' : ''}"
              >
                <span class="disp-badge-grupo">
                  <span class="disp-badge-grupo-nombre">${_esc(asigInterna.grupo_nombre)}</span>
                </span>
              </div>
            </td>
          `;
        }

        if (ocupadoExterno) {
          return `
            <td>
              <div
                class="disp-celda ocupado"
                title="No disponible (ocupado en otra institución)"
                style="cursor:default;${compacta ? 'width:30px;height:30px;' : ''}"
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </div>
            </td>
          `;
        }

        return `
          <td>
            <div
              class="disp-celda"
              title="Disponible en el liceo (Libre)"
              style="cursor:default;opacity:0.75;${compacta ? 'width:30px;height:30px;' : ''}"
            ></div>
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
              <span style="font-weight:700;font-size:${compacta ? '0.65rem' : 'var(--text-xs)'};color:var(--text);">${_esc(etiqueta)}</span>
              ${compacta ? '' : `<span style="font-size:0.7rem;color:var(--text-muted);">${rango}</span>`}
            </div>
          </td>
          ${celdas}
        </tr>
      `;
    }).join('');

    return `
      <div class="disponibilidad-tabla-wrap" style="border:none;border-radius:0;">
        <table class="tabla-disponibilidad" style="${compacta ? 'font-size:0.75rem;' : ''}">
          <thead>${theadHTML}</thead>
          <tbody>${tbodyHTML}</tbody>
        </table>
      </div>
    `;
  }

  // ── Utilidades ───────────────────────────────────────────────
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

  function _renderizarError(mensaje) {
    const contenedor = document.getElementById('consulta-contenedor');
    if (!contenedor) return;
    contenedor.innerHTML = `
      <div class="estado-vacio" style="padding:4rem 1rem;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;color:var(--error);margin-bottom:1rem;" aria-hidden="true"></i>
        <h3>No se pudo cargar la consulta</h3>
        <p>${_esc(mensaje)}</p>
      </div>
    `;
  }

})();
