// ============================================================
// modulos/asignacion_grupo.js — Módulo Asignar Docente a Grupo
// Gestión de asignación de docentes por asignatura y grupo
// Soporta duplas (ej. Taller), ordenamiento por escalafón
// y filtros interactivos por nivel educativo.
// Depende de: js/ui.js, css/estilos.css, css/dashboard.css, css/formularios.css
// ============================================================

window.Modulo_asignacion_grupo = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor           = null;
  let _niveles              = [];
  let _grupos               = [];
  let _nivelActivo          = null;  // null = todos o ID del nivel
  let _grupoSeleccionadoId  = null;  // ID del grupo cargado
  let _estructuraGrupo      = null;  // { grupo, asignaturas: [...] }
  let _duplasHabilitadas    = {};    // { [idAsignatura]: boolean }
  let _cargando             = false;

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_NIVELES          = () => `${App.API_BASE}/niveles`;
  const URL_GRUPOS           = () => `${App.API_BASE}/grupos`;
  const URL_ESTRUCTURA_GRUPO = (id) => `${App.API_BASE}/asignacion_docente/estructura_completa/${id}`;
  const URL_ASIGNAR          = () => `${App.API_BASE}/asignacion_docente`;
  const URL_DESASIGNAR       = (id) => `${App.API_BASE}/asignacion_docente/${id}`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  /**
   * Punto de entrada del módulo.
   * @param {HTMLElement} contenedor
   * @param {number|null} idGrupoInicial - Opcional, grupo preseleccionado
   */
  async function render(contenedor, idGrupoInicial = null) {
    _contenedor = contenedor;
    _inyectarEstilos();

    _contenedor.innerHTML = `
      <div class="asignacion-layout">
        
        <!-- Header del Módulo -->
        ${UI.headerModulo(
          'Asignar Docentes a Grupos',
          'Configurá qué profesores dictan cada materia en cada grupo escolar (incluye soporte para duplas y talleres).',
          `<button class="btn btn-secondary" id="btn-ir-armado" title="Ir al armado de horarios">
             <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
             Armar Horarios
           </button>`
        )}

        <!-- Barra de Selección y Filtros -->
        <div class="asignacion-filtros-card card">
          <div class="asignacion-filtros-grid">
            
            <!-- Selector de Nivel -->
            <div class="filtro-campo">
              <label class="filtro-label" for="filtro-nivel-select">
                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                Filtrar por Nivel:
              </label>
              <div class="select-wrapper">
                <select id="filtro-nivel-select" class="campo-select">
                  <option value="">— Todos los niveles —</option>
                </select>
              </div>
            </div>

            <!-- Selector de Grupo -->
            <div class="filtro-campo">
              <label class="filtro-label" for="filtro-grupo-select">
                <i class="fa-solid fa-users" aria-hidden="true"></i>
                Seleccionar Grupo:
              </label>
              <div class="select-wrapper">
                <select id="filtro-grupo-select" class="campo-select">
                  <option value="">— Seleccioná un grupo —</option>
                </select>
              </div>
            </div>

          </div>

          <!-- Tabs Rápidos de Niveles -->
          <div class="niveles-pills-bar" id="niveles-pills-bar"></div>
        </div>

        <!-- Área de Contenido Principal: Resumen + Asignaturas -->
        <div id="asignacion-contenido-wrap" class="asignacion-contenido-wrap">
          <div class="estado-vacio">
            <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
            <h3>Seleccioná un grupo para comenzar</h3>
            <p>Elegí un nivel y un grupo del selector superior para asignar a sus docentes por asignatura.</p>
          </div>
        </div>

      </div>
    `;

    document.getElementById('btn-ir-armado')?.addEventListener('click', () => {
      App.navegarA('armado');
    });

    await _cargarDatosIniciales(idGrupoInicial);
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA INICIAL DE DATOS
  // ════════════════════════════════════════════════════════════

  async function _cargarDatosIniciales(idGrupoInicial = null) {
    try {
      const [rNiveles, rGrupos] = await Promise.all([
        fetch(URL_NIVELES()),
        fetch(URL_GRUPOS())
      ]);

      if (!rNiveles.ok || !rGrupos.ok) {
        throw new Error('Error al cargar niveles y grupos');
      }

      _niveles = await rNiveles.json();
      _grupos  = await rGrupos.json();

      _poblarSelectNiveles();
      _renderizarPillsNiveles();
      _actualizarSelectGrupos();

      // Si viene un grupo preseleccionado o hay grupos disponibles
      if (idGrupoInicial) {
        _seleccionarGrupo(idGrupoInicial);
      } else if (_grupos.length > 0 && !_grupoSeleccionadoId) {
        _seleccionarGrupo(_grupos[0].id);
      }
    } catch (error) {
      UI.mostrarToast('No se pudieron cargar los datos de niveles y grupos.', 'error');
      console.error(error);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  POBLAR SELECTS Y TABS
  // ════════════════════════════════════════════════════════════

  function _poblarSelectNiveles() {
    const select = document.getElementById('filtro-nivel-select');
    if (!select) return;

    select.innerHTML = '<option value="">— Todos los niveles —</option>' +
      _niveles.map(n => `<option value="${n.id}">${_esc(n.nombre)}</option>`).join('');

    select.addEventListener('change', (e) => {
      const val = e.target.value ? Number(e.target.value) : null;
      _setNivelActivo(val);
    });
  }

  function _renderizarPillsNiveles() {
    const bar = document.getElementById('niveles-pills-bar');
    if (!bar) return;

    let html = `
      <button class="nivel-pill ${_nivelActivo === null ? 'active' : ''}" data-nivel-id="todos">
        Todos
      </button>
    `;

    _niveles.forEach(n => {
      const isActive = _nivelActivo === n.id ? 'active' : '';
      html += `
        <button class="nivel-pill ${isActive}" data-nivel-id="${n.id}">
          ${_esc(n.nombre)}
        </button>
      `;
    });

    bar.innerHTML = html;

    bar.querySelectorAll('.nivel-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const idStr = btn.dataset.nivelId;
        const id = idStr === 'todos' ? null : Number(idStr);
        _setNivelActivo(id);
      });
    });
  }

  function _setNivelActivo(idNivel) {
    _nivelActivo = idNivel;

    // Sincronizar select
    const selectNivel = document.getElementById('filtro-nivel-select');
    if (selectNivel) selectNivel.value = idNivel !== null ? String(idNivel) : '';

    // Sincronizar pills
    _renderizarPillsNiveles();

    // Actualizar grupos filtrados
    _actualizarSelectGrupos();

    // Si el grupo actual no coincide con el nuevo filtro, seleccionar el primero disponible
    const gruposFiltrados = _obtenerGruposFiltrados();
    if (gruposFiltrados.length > 0) {
      const grupoSigueValido = gruposFiltrados.some(g => g.id === _grupoSeleccionadoId);
      if (!grupoSigueValido) {
        _seleccionarGrupo(gruposFiltrados[0].id);
      }
    } else {
      _grupoSeleccionadoId = null;
      _estructuraGrupo = null;
      _renderizarContenidoVacio('No hay grupos creados para este nivel.');
    }
  }

  function _obtenerGruposFiltrados() {
    if (_nivelActivo === null) return _grupos;
    return _grupos.filter(g => g.id_nivel === _nivelActivo);
  }

  function _actualizarSelectGrupos() {
    const select = document.getElementById('filtro-grupo-select');
    if (!select) return;

    const filtrados = _obtenerGruposFiltrados();

    if (filtrados.length === 0) {
      select.innerHTML = '<option value="">No hay grupos en este nivel</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">— Seleccioná un grupo —</option>' +
      filtrados.map(g => `
        <option value="${g.id}" ${_grupoSeleccionadoId === g.id ? 'selected' : ''}>
          ${_esc(g.nivel_nombre)}${g.numero} — ${_esc(g.turno_nombre)}
        </option>
      `).join('');

    select.onchange = (e) => {
      const id = Number(e.target.value);
      if (id) _seleccionarGrupo(id);
    };
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA Y RENDERIZADO DEL GRUPO SELECCIONADO
  // ════════════════════════════════════════════════════════════

  async function _seleccionarGrupo(idGrupo) {
    if (!idGrupo) return;
    _grupoSeleccionadoId = idGrupo;

    // Sincronizar select
    const select = document.getElementById('filtro-grupo-select');
    if (select) select.value = String(idGrupo);

    const wrap = document.getElementById('asignacion-contenido-wrap');
    if (!wrap) return;

    UI.mostrarCargando(wrap, 'Cargando asignaturas y docentes del grupo...');

    try {
      const res = await fetch(URL_ESTRUCTURA_GRUPO(idGrupo));
      if (!res.ok) throw new Error('Error al cargar la estructura del grupo');

      _estructuraGrupo = await res.json();
      _renderizarEstructuraGrupo();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'Error al conectar',
        UI.mensajeError(error)
      );
    }
  }

  function _renderizarEstructuraGrupo() {
    const wrap = document.getElementById('asignacion-contenido-wrap');
    if (!wrap || !_estructuraGrupo) return;

    const { grupo, asignaturas } = _estructuraGrupo;

    if (!asignaturas || asignaturas.length === 0) {
      _renderizarContenidoVacio(`El nivel "${grupo.nivel_nombre}" no tiene asignaturas registradas. Creá asignaturas primero desde el menú Asignaturas.`);
      return;
    }

    // Cálculos de resumen
    const totalAsignaturas = asignaturas.length;
    let cubiertas = 0;
    let totalHoras = 0;

    asignaturas.forEach(a => {
      totalHoras += (a.carga_horaria || 0);
      if (a.asignados && a.asignados.length > 0) {
        cubiertas++;
      }
    });

    const porcentajeCubierto = totalAsignaturas > 0 ? Math.round((cubiertas / totalAsignaturas) * 100) : 0;

    wrap.innerHTML = `
      <!-- Panel de Resumen del Grupo -->
      <div class="asignacion-resumen-banner">
        <div class="resumen-info-left">
          <div class="resumen-grupo-badge">
            <span class="grupo-chip-nivel">${_esc(grupo.nivel_nombre)}</span><span class="grupo-chip-num">${_esc(String(grupo.numero))}</span>
          </div>
          <div>
            <h3 class="resumen-titulo">Grupo ${_esc(grupo.nivel_nombre)}${grupo.numero}</h3>
            <span class="resumen-subtitulo">
              <i class="fa-solid fa-clock" aria-hidden="true"></i> Turno ${_esc(grupo.turno_nombre)} &nbsp;•&nbsp; 
              <i class="fa-solid fa-layer-group" aria-hidden="true"></i> Nivel ${_esc(grupo.nivel_nombre)}
            </span>
          </div>
        </div>

        <div class="resumen-stats">
          <div class="stat-box">
            <span class="stat-numero">${cubiertas}/${totalAsignaturas}</span>
            <span class="stat-label">Materias Cubiertas</span>
          </div>
          <div class="stat-box">
            <span class="stat-numero">${totalHoras} hs</span>
            <span class="stat-label">Carga Semanal</span>
          </div>
          <div class="stat-box">
            <span class="stat-numero ${porcentajeCubierto === 100 ? 'stat-completo' : ''}">${porcentajeCubierto}%</span>
            <span class="stat-label">Progreso</span>
          </div>
        </div>
      </div>

      <!-- Grid de Asignaturas -->
      <div class="asignaturas-grid">
        ${asignaturas.map(asig => _renderizarTarjetaAsignatura(asig)).join('')}
      </div>
    `;

    _bindEventosAsignaturas();
  }

  function _renderizarContenidoVacio(mensaje) {
    const wrap = document.getElementById('asignacion-contenido-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="estado-vacio">
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        <h3>Sin datos</h3>
        <p>${_esc(mensaje)}</p>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  TARJETA DE ASIGNATURA
  // ════════════════════════════════════════════════════════════

  function _renderizarTarjetaAsignatura(asig) {
    const asignados = asig.asignados || [];
    const docentesHabilitados = asig.docentes_habilitados || [];
    const tieneDuplaHabilitada = _duplasHabilitadas[asig.id_asignatura] || asignados.length > 1;

    // Docente 1 (Principal)
    const asig1 = asignados[0] || null;
    // Docente 2 (Dupla)
    const asig2 = asignados[1] || null;

    const estadoClase = asignados.length === 0 
      ? 'estado-pendiente' 
      : (asignados.length > 1 ? 'estado-dupla' : 'estado-cubierto');

    return `
      <div class="asignatura-card ${estadoClase}" id="card-asig-${asig.id_asignatura}" data-asig-id="${asig.id_asignatura}">
        
        <!-- Header de la Tarjeta -->
        <div class="asig-card-header">
          <div class="asig-card-titulo-wrap">
            <span class="asig-card-icon">
              <i class="fa-solid fa-book" aria-hidden="true"></i>
            </span>
            <div>
              <h4 class="asig-card-nombre">${_esc(asig.nombre)}</h4>
              <span class="asig-card-horas badge badge-accent">
                <i class="fa-solid fa-clock" aria-hidden="true"></i> ${asig.carga_horaria} horas/sem
              </span>
            </div>
          </div>

          <div class="asig-card-estado">
            ${_renderizarBadgeEstado(asignados.length)}
          </div>
        </div>

        <!-- Cuerpo: Selectores de Docentes -->
        <div class="asig-card-body">
          
          <!-- Docente 1 (Principal) -->
          <div class="slot-docente">
            <div class="slot-docente-header">
              <label class="slot-label">
                <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
                ${tieneDuplaHabilitada ? 'Docente 1 (Titular)' : 'Docente Asignado'}
              </label>
              ${asig1 ? `
                <button class="btn-quitar-docente" 
                        data-accion="desasignar" 
                        data-asig-id="${asig.id_asignatura}" 
                        data-asignacion-id="${asig1.id_asignacion}"
                        data-nombre-docente="${_esc(asig1.docente_apellido)}, ${_esc(asig1.docente_nombre)}"
                        title="Quitar docente de esta asignatura">
                  <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Quitar
                </button>
              ` : ''}
            </div>

            <div class="select-docente-wrap">
              <select class="campo-select select-docente-dropdown" 
                      data-asig-id="${asig.id_asignatura}" 
                      data-slot="1"
                      ${asig1 ? 'data-asignado="true"' : ''}>
                <option value="">— Seleccionar docente (${docentesHabilitados.length} habilitados) —</option>
                ${docentesHabilitados.map(dh => {
                  const seleccionado = asig1 && asig1.id_docente_asignatura === dh.id_docente_asignatura;
                  const deshabilitado = asig2 && asig2.id_docente_asignatura === dh.id_docente_asignatura;
                  const etiqueta = _formatearDocenteOption(dh);
                  return `
                    <option value="${dh.id_docente_asignatura}" 
                            ${seleccionado ? 'selected' : ''} 
                            ${deshabilitado ? 'disabled' : ''}>
                      ${_esc(etiqueta)} ${deshabilitado ? '(En Slot 2)' : ''}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            ${asig1 ? _renderizarInfoDocenteBadge(asig1) : ''}
          </div>

          <!-- Docente 2 (Dupla / Taller) -->
          ${tieneDuplaHabilitada ? `
            <div class="slot-docente slot-dupla animate-fade-in">
              <div class="slot-docente-header">
                <label class="slot-label slot-label-dupla">
                  <i class="fa-solid fa-user-group" aria-hidden="true"></i>
                  Docente 2 (Dupla / Taller)
                </label>
                ${asig2 ? `
                  <button class="btn-quitar-docente" 
                          data-accion="desasignar" 
                          data-asig-id="${asig.id_asignatura}" 
                          data-asignacion-id="${asig2.id_asignacion}"
                          data-nombre-docente="${_esc(asig2.docente_apellido)}, ${_esc(asig2.docente_nombre)}"
                          title="Quitar 2° docente">
                    <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Quitar
                  </button>
                ` : `
                  <button class="btn-cerrar-dupla" 
                          data-accion="cancelar-dupla" 
                          data-asig-id="${asig.id_asignatura}"
                          title="Ocultar segundo docente">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i> Ocultar
                  </button>
                `}
              </div>

              <div class="select-docente-wrap">
                <select class="campo-select select-docente-dropdown" 
                        data-asig-id="${asig.id_asignatura}" 
                        data-slot="2"
                        ${asig2 ? 'data-asignado="true"' : ''}>
                  <option value="">— Seleccionar 2° docente (Dupla) —</option>
                  ${docentesHabilitados.map(dh => {
                    const seleccionado = asig2 && asig2.id_docente_asignatura === dh.id_docente_asignatura;
                    const deshabilitado = asig1 && asig1.id_docente_asignatura === dh.id_docente_asignatura;
                    const etiqueta = _formatearDocenteOption(dh);
                    return `
                      <option value="${dh.id_docente_asignatura}" 
                              ${seleccionado ? 'selected' : ''} 
                              ${deshabilitado ? 'disabled' : ''}>
                        ${_esc(etiqueta)} ${deshabilitado ? '(En Slot 1)' : ''}
                      </option>
                    `;
                  }).join('')}
                </select>
              </div>

              ${asig2 ? _renderizarInfoDocenteBadge(asig2) : ''}
            </div>
          ` : `
            <!-- Botón para habilitar dupla / 2° docente -->
            <div class="asig-card-footer">
              <button class="btn-habilitar-dupla" data-accion="habilitar-dupla" data-asig-id="${asig.id_asignatura}">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                Agregar 2° Docente (Dupla / Taller)
              </button>
            </div>
          `}

        </div>

      </div>
    `;
  }

  function _formatearDocenteOption(dh) {
    const condicion = dh.efectivo ? 'Efectivo' : 'Interino';
    const puntaje = Number(dh.puntaje).toFixed(2);
    return `${dh.docente_apellido}, ${dh.docente_nombre} — [${condicion} | Gr. ${dh.grado} | ${puntaje} pts]`;
  }

  function _renderizarBadgeEstado(cantAsignados) {
    if (cantAsignados === 0) {
      return `<span class="badge badge-warning"><i class="fa-solid fa-clock" aria-hidden="true"></i> Pendiente</span>`;
    }
    if (cantAsignados === 1) {
      return `<span class="badge badge-success"><i class="fa-solid fa-check" aria-hidden="true"></i> Cubierta</span>`;
    }
    return `<span class="badge badge-info"><i class="fa-solid fa-user-group" aria-hidden="true"></i> Dupla (2 Docentes)</span>`;
  }

  function _renderizarInfoDocenteBadge(docente) {
    const condicion = docente.efectivo ? 'Efectivo' : 'Interino';
    const claseBadge = docente.efectivo ? 'badge-efectivo' : 'badge-interino';
    return `
      <div class="docente-asignado-meta">
        <span class="meta-tag ${claseBadge}">
          <i class="fa-solid fa-award" aria-hidden="true"></i> ${condicion}
        </span>
        <span class="meta-tag">
          <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Grado ${docente.grado}
        </span>
        <span class="meta-tag">
          <i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(docente.puntaje).toFixed(2)} pts
        </span>
        <span class="meta-cedula">C.I. ${_esc(docente.cedula)}</span>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  EVENTOS Y ACCIONES DE ASIGNACIÓN
  // ════════════════════════════════════════════════════════════

  function _bindEventosAsignaturas() {
    const wrap = document.getElementById('asignacion-contenido-wrap');
    if (!wrap) return;

    // Cambios en los dropdowns de docentes
    wrap.querySelectorAll('.select-docente-dropdown').forEach(select => {
      select.addEventListener('change', async (e) => {
        const idAsignatura = Number(select.dataset.asigId);
        const slot = Number(select.dataset.slot);
        const idDocenteAsignatura = select.value ? Number(select.value) : null;

        if (idDocenteAsignatura) {
          await _guardarAsignacion(idAsignatura, idDocenteAsignatura, slot, select);
        }
      });
    });

    // Botones de desasignar / quitar
    wrap.querySelectorAll('[data-accion="desasignar"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idAsignacion = Number(btn.dataset.asignacionId);
        const nombreDocente = btn.dataset.nombreDocente;
        await _desasignarDocente(idAsignacion, nombreDocente);
      });
    });

    // Botón para habilitar dupla
    wrap.querySelectorAll('[data-accion="habilitar-dupla"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idAsignatura = Number(btn.dataset.asigId);
        _duplasHabilitadas[idAsignatura] = true;
        _renderizarEstructuraGrupo();
      });
    });

    // Botón para cancelar/ocultar dupla no asignada
    wrap.querySelectorAll('[data-accion="cancelar-dupla"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idAsignatura = Number(btn.dataset.asigId);
        delete _duplasHabilitadas[idAsignatura];
        _renderizarEstructuraGrupo();
      });
    });
  }

  async function _guardarAsignacion(idAsignatura, idDocenteAsignatura, slot, selectElement) {
    if (_cargando) return;
    _cargando = true;

    selectElement.disabled = true;

    try {
      const res = await fetch(URL_ASIGNAR(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_grupo: _grupoSeleccionadoId,
          id_asignatura: idAsignatura,
          id_docente_asignatura: idDocenteAsignatura
        })
      });

      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo asignar el docente.', 'error');
        // Revertir valor
        _recargarGrupoActual();
        return;
      }

      UI.mostrarToast('Docente asignado correctamente.', 'success');
      await _recargarGrupoActual();
    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
      _recargarGrupoActual();
    } finally {
      _cargando = false;
    }
  }

  async function _desasignarDocente(idAsignacion, nombreDocente) {
    const confirmado = await UI.confirmar(
      'Quitar docente asignado',
      `¿Estás seguro de que querés desasignar a ${nombreDocente} de esta materia en este grupo?`,
      { labelConfirmar: 'Quitar', variante: 'danger' }
    );

    if (!confirmado) return;

    try {
      const res = await fetch(URL_DESASIGNAR(idAsignacion), { method: 'DELETE' });
      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo quitar la asignación.', 'error');
        return;
      }

      UI.mostrarToast(`${nombreDocente} fue desasignado.`, 'success');
      await _recargarGrupoActual();
    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
    }
  }

  async function _recargarGrupoActual() {
    if (!_grupoSeleccionadoId) return;
    try {
      const res = await fetch(URL_ESTRUCTURA_GRUPO(_grupoSeleccionadoId));
      if (res.ok) {
        _estructuraGrupo = await res.json();
        _renderizarEstructuraGrupo();
      }
    } catch (err) {
      console.error(err);
    }
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
    if (document.getElementById('style-modulo-asignacion-grupo')) return;
    const style = document.createElement('style');
    style.id = 'style-modulo-asignacion-grupo';
    style.textContent = `
      .asignacion-layout {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      /* ── Tarjeta de Filtros ── */
      .asignacion-filtros-card {
        padding: 1.25rem 1.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .asignacion-filtros-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.25rem;
      }

      .filtro-campo {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .filtro-label {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      /* ── Pills Bar de Niveles ── */
      .niveles-pills-bar {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding-top: 0.25rem;
        border-top: 1px solid var(--border-subtle);
      }

      .nivel-pill {
        padding: 0.35rem 0.85rem;
        border-radius: var(--radius-full);
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--border);
        color: var(--text-muted);
        font-size: var(--text-xs);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .nivel-pill:hover {
        background: rgba(255,255,255,0.08);
        color: var(--text);
        border-color: var(--accent-border);
      }

      .nivel-pill.active {
        background: var(--accent-subtle);
        color: var(--accent-hover);
        border-color: var(--accent);
        box-shadow: 0 0 10px rgba(99,102,241,0.25);
      }

      /* ── Banner de Resumen del Grupo ── */
      .asignacion-resumen-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.25rem;
        padding: 1.2rem 1.5rem;
        background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%);
        border: 1px solid var(--accent-border);
        border-radius: var(--radius-md);
      }

      .resumen-info-left {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .resumen-grupo-badge {
        display: inline-flex;
        border-radius: var(--radius-sm);
        overflow: hidden;
        font-size: 1.1rem;
        font-weight: 800;
        border: 1px solid var(--accent);
      }

      .resumen-titulo {
        font-size: var(--text-lg);
        font-weight: 700;
        color: var(--text);
        margin: 0;
      }

      .resumen-subtitulo {
        font-size: var(--text-xs);
        color: var(--text-muted);
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.2rem;
      }

      .resumen-stats {
        display: flex;
        gap: 1.5rem;
        align-items: center;
      }

      .stat-box {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .stat-numero {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--text);
      }

      .stat-numero.stat-completo {
        color: #10b981;
      }

      .stat-label {
        font-size: var(--text-xs);
        color: var(--text-muted);
      }

      /* ── Grid de Asignaturas ── */
      .asignaturas-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
        gap: 1.25rem;
      }

      .asignatura-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        transition: all 0.2s ease;
        position: relative;
      }

      .asignatura-card:hover {
        border-color: rgba(99,102,241,0.4);
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      }

      .asignatura-card.estado-cubierto {
        border-left: 4px solid #10b981;
      }

      .asignatura-card.estado-dupla {
        border-left: 4px solid #0ea5e9;
      }

      .asignatura-card.estado-pendiente {
        border-left: 4px solid #f59e0b;
      }

      .asig-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
        padding-bottom: 0.75rem;
      }

      .asig-card-titulo-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .asig-card-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-sm);
        background: var(--accent-subtle);
        color: var(--accent-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
      }

      .asig-card-nombre {
        font-size: var(--text-base);
        font-weight: 700;
        color: var(--text);
        margin: 0;
      }

      .asig-card-horas {
        font-size: 0.7rem;
        margin-top: 0.2rem;
        display: inline-block;
      }

      .asig-card-body {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .slot-docente {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        background: rgba(255,255,255,0.02);
        padding: 0.75rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-subtle);
      }

      .slot-dupla {
        background: rgba(14,165,233,0.04);
        border-color: rgba(14,165,233,0.25);
      }

      .slot-docente-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .slot-label {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .slot-label-dupla {
        color: #38bdf8;
      }

      .btn-quitar-docente {
        background: none;
        border: none;
        color: #ef4444;
        font-size: var(--text-xs);
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.4rem;
        border-radius: var(--radius-xs);
        transition: background 0.15s;
      }

      .btn-quitar-docente:hover {
        background: rgba(239,68,68,0.15);
      }

      .btn-cerrar-dupla {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: var(--text-xs);
        cursor: pointer;
      }

      .btn-cerrar-dupla:hover {
        color: var(--text);
      }

      .docente-asignado-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.35rem;
        font-size: var(--text-xs);
      }

      .meta-tag {
        background: rgba(255,255,255,0.06);
        padding: 0.15rem 0.45rem;
        border-radius: var(--radius-xs);
        color: var(--text-muted);
        font-size: 0.72rem;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .badge-efectivo {
        background: rgba(16,185,129,0.15);
        color: #34d399;
        border: 1px solid rgba(16,185,129,0.3);
      }

      .badge-interino {
        background: rgba(245,158,11,0.15);
        color: #fbbf24;
        border: 1px solid rgba(245,158,11,0.3);
      }

      .meta-cedula {
        color: var(--text-muted);
        font-size: 0.72rem;
        margin-left: auto;
      }

      .asig-card-footer {
        display: flex;
        justify-content: flex-end;
      }

      .btn-habilitar-dupla {
        background: rgba(14,165,233,0.08);
        border: 1px dashed rgba(14,165,233,0.4);
        color: #38bdf8;
        font-size: var(--text-xs);
        font-weight: 600;
        padding: 0.4rem 0.8rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        transition: all 0.2s;
      }

      .btn-habilitar-dupla:hover {
        background: rgba(14,165,233,0.16);
        border-style: solid;
      }

      .animate-fade-in {
        animation: fadeIn 0.2s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  // ── API Pública ──────────────────────────────────────────────
  return {
    render,
    seleccionarGrupo: (id) => _seleccionarGrupo(id)
  };

})();
