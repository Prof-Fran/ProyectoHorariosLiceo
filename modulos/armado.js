// ============================================================
// modulos/armado.js — Módulo Armado de Horarios
// Fase 7.1 + 7.2 + 7.2B: Interfaz, Funcionalidad y Asignación a Grupo
// Pantalla de selección de grupo, asignación de docentes,
// grilla semanal y lista de docentes
// Depende de: js/ui.js, css/horario.css
// ============================================================

window.Modulo_armado = (() => {

  // ── Estado interno del módulo ─────────────────────────────────
  let _contenedor      = null;
  let _grupos          = [];
  let _turnos          = [];
  let _docentes        = [];
  let _asignacionesDocente = {}; // Cache de asignaturas por docente
  let _grupoActual     = null;  // Grupo seleccionado
  let _horasTurno      = [];    // Horas del turno del grupo actual
  let _horarioGrupo    = [];    // Asignaciones del grupo actual
  let _docenteSeleccionado = null; // Docente seleccionado para asignar
  let _asignaturaSeleccionada = null; // Asignatura del docente seleccionado
  let _docentesAsignadosGrupo = []; // Docentes asignados al grupo actual
  let _docentesDisponiblesNivel = []; // Docentes disponibles del nivel

  // ── Constantes ────────────────────────────────────────────────
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

  // ── Endpoints ─────────────────────────────────────────────────
  const URL_GRUPOS   = () => `${App.API_BASE}/grupos`;
  const URL_TURNOS   = () => `${App.API_BASE}/turnos`;
  const URL_HORARIOS = (idTurno) => `${App.API_BASE}/horarios_turno/por_turno/${idTurno}`;
  const URL_DOCENTES = () => `${App.API_BASE}/docentes`;
  const URL_DOC_ASIG = (idDoc) => `${App.API_BASE}/docentes/${idDoc}/asignaturas`;
  const URL_HORARIO_GRUPO = (idGrupo) => `${App.API_BASE}/horario_grupo/por_grupo/${idGrupo}`;
  const URL_INSERTAR  = () => `${App.API_BASE}/horario_grupo`;
  const URL_ELIMINAR  = (id) => `${App.API_BASE}/horario_grupo/${id}`;
  const URL_ASIG_DOC_GRUPO = (idGrupo) => `${App.API_BASE}/asignacion_docente/por_grupo_con_detalle/${idGrupo}`;
  const URL_DISPONIBLES_GRUPO = (idGrupo) => `${App.API_BASE}/asignacion_docente/disponibles_grupo/${idGrupo}`;
  const URL_ASIG_DOC_CREAR = () => `${App.API_BASE}/asignacion_docente`;
  const URL_ASIG_DOC_ELIMINAR = (id) => `${App.API_BASE}/asignacion_docente/${id}`;

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO PRINCIPAL
  // ════════════════════════════════════════════════════════════

  async function render(contenedor) {
    _contenedor = contenedor;
    _grupoActual = null;
    _inyectarEstilos();

    _contenedor.innerHTML = `
      <div id="armado-seleccion" class="seleccion-grupo-layout">
        <!-- Se carga dinámicamente -->
      </div>
      <div id="armado-asignar-docentes" style="display:none;">
        <!-- Pantalla intermedia de asignación -->
      </div>
      <div id="armado-editor" class="horario-layout" style="display:none;">
        <!-- Se carga al seleccionar grupo -->
      </div>
    `;

    await _cargarGruposParaSeleccion();
  }

  // ════════════════════════════════════════════════════════════
  //  7.1.1 PANTALLA DE SELECCIÓN DE GRUPO
  // ════════════════════════════════════════════════════════════

  async function _cargarGruposParaSeleccion() {
    const wrap = document.getElementById('armado-seleccion');
    if (!wrap) return;

    UI.mostrarCargando(wrap, 'Cargando grupos...');

    try {
      const [rGrupos, rTurnos] = await Promise.all([
        fetch(URL_GRUPOS()),
        fetch(URL_TURNOS()),
      ]);

      if (!rGrupos.ok || !rTurnos.ok) throw new Error('Error al obtener datos');

      _grupos = await rGrupos.json();
      _turnos = await rTurnos.json();

      _renderizarSeleccionGrupo();
    } catch (error) {
      UI.renderizarVacio(
        wrap,
        'fa-solid fa-triangle-exclamation',
        'No se pudo conectar',
        UI.mensajeError(error)
      );
    }
  }

  function _renderizarSeleccionGrupo() {
    const wrap = document.getElementById('armado-seleccion');
    if (!wrap) return;

    // Agrupar grupos por nivel
    const gruposPorNivel = {};
    _grupos.forEach(g => {
      const nivel = g.nivel_nombre || 'Sin nivel';
      if (!gruposPorNivel[nivel]) gruposPorNivel[nivel] = [];
      gruposPorNivel[nivel].push(g);
    });

    let htmlNiveles = '';

    // Ordenar niveles
    const nivelesOrdenados = Object.keys(gruposPorNivel).sort((a, b) => a.localeCompare(b, 'es'));

    nivelesOrdenados.forEach(nivel => {
      const grupos = gruposPorNivel[nivel];
      htmlNiveles += `
        <div class="armado-nivel-seccion">
          <h3 class="armado-nivel-titulo">${_esc(nivel)}</h3>
          <div class="grupos-grid-seleccion">
            ${grupos.map(g => `
              <button class="grupo-card-seleccion" data-grupo-id="${g.id}">
                <span class="grupo-card-nombre">${_esc(g.nivel_nombre)}${g.numero}</span>
                <span class="grupo-card-info">${_esc(g.turno_nombre)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    });

    if (_grupos.length === 0) {
      wrap.innerHTML = `
        <div class="seleccion-grupo-layout">
          <div class="seleccion-grupo-header">
            <h2>Armar Horarios</h2>
            <p>Seleccioná un grupo para comenzar a armar su horario</p>
          </div>
          <div class="estado-vacio">
            <i class="fa-solid fa-users" aria-hidden="true"></i>
            <h3>No hay grupos disponibles</h3>
            <p>Creá grupos primero desde el módulo "Grupos" para poder armar horarios.</p>
          </div>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="seleccion-grupo-header">
        <h2>Armar Horarios</h2>
        <p>Seleccioná un grupo para comenzar a armar su horario</p>
      </div>
      <div id="armado-grupos-por-nivel">
        ${htmlNiveles}
      </div>
    `;

    // Eventos de selección
    wrap.querySelectorAll('.grupo-card-seleccion').forEach(btn => {
      btn.addEventListener('click', () => {
        const idGrupo = Number(btn.dataset.grupoId);
        const grupo = _grupos.find(g => g.id === idGrupo);
        if (grupo) _seleccionarGrupo(grupo);
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  //  SELECCIÓN DE GRUPO Y CARGA INICIAL
  // ════════════════════════════════════════════════════════════

  async function _seleccionarGrupo(grupo) {
    _grupoActual = grupo;

    // Ocultar selección, mostrar pantalla de asignación de docentes
    document.getElementById('armado-seleccion').style.display = 'none';
    const asignarDocentes = document.getElementById('armado-asignar-docentes');
    asignarDocentes.style.display = 'block';

    UI.mostrarCargando(asignarDocentes, 'Cargando información del grupo...');

    try {
      // Cargar datos del grupo en paralelo
      const [rHoras, rAsignados, rDisponibles] = await Promise.all([
        fetch(URL_HORARIOS(grupo.id_turno)),
        fetch(URL_ASIG_DOC_GRUPO(grupo.id)),
        fetch(URL_DISPONIBLES_GRUPO(grupo.id)),
      ]);

      if (!rHoras.ok || !rAsignados.ok || !rDisponibles.ok) {
        throw new Error('Error al cargar datos del grupo');
      }

      _horasTurno = await rHoras.json();
      _docentesAsignadosGrupo = await rAsignados.json();
      _docentesDisponiblesNivel = await rDisponibles.json();

      _renderizarAsignarDocentes();
    } catch (error) {
      UI.renderizarVacio(
        asignarDocentes,
        'fa-solid fa-triangle-exclamation',
        'No se pudo cargar el grupo',
        UI.mensajeError(error)
      );
    }
  }

  async function _cargarAsignaturasDocentes() {
    const promesas = _docentes.map(async (doc) => {
      try {
        const res = await fetch(URL_DOC_ASIG(doc.id));
        if (res.ok) {
          _asignacionesDocente[doc.id] = await res.json();
        }
      } catch {
        _asignacionesDocente[doc.id] = [];
      }
    });
    await Promise.all(promesas);
  }

  // ════════════════════════════════════════════════════════════
  //  7.2B PANTALLA ASIGNAR DOCENTES AL GRUPO
  // ════════════════════════════════════════════════════════════

  function _renderizarAsignarDocentes() {
    const wrap = document.getElementById('armado-asignar-docentes');
    if (!wrap) return;

    const g = _grupoActual;

    // Agrupar docentes disponibles por materia
    const disponiblesPorMateria = {};
    _docentesDisponiblesNivel.forEach(doc => {
      if (doc.asignaturas) {
        doc.asignaturas.forEach(asig => {
          if (!disponiblesPorMateria[asig.nombre]) {
            disponiblesPorMateria[asig.nombre] = [];
          }
          disponiblesPorMateria[asig.nombre].push({
            id: doc.id,
            nombre: doc.nombre,
            apellido: doc.apellido,
            cedula: doc.cedula,
            id_asignatura: asig.id,
            carga_horaria: asig.carga_horaria
          });
        });
      }
    });

    // Construir HTML de docentes disponibles
    let htmlDisponibles = '';
    const materias = Object.keys(disponiblesPorMateria).sort();

    if (materias.length === 0) {
      htmlDisponibles = `
        <div class="armado-docente-vacio">
          <i class="fa-solid fa-user-slash" aria-hidden="true"></i>
          <p>No hay docentes disponibles para este nivel.</p>
          <p class="text-muted text-xs">Podés continuar y asignar docentes después desde el armado.</p>
        </div>
      `;
    } else {
      materias.forEach(materia => {
        const docentes = disponiblesPorMateria[materia];
        htmlDisponibles += `
          <div class="armado-materia-grupo">
            <h4 class="armado-materia-titulo">
              <i class="fa-solid fa-book" aria-hidden="true"></i>
              ${_esc(materia)}
            </h4>
            <div class="armado-docentes-lista">
              ${docentes.map(doc => `
                <div class="armado-docente-item" data-docente-id="${doc.id}" data-asig-id="${doc.id_asignatura}">
                  <div class="armado-docente-info">
                    <span class="armado-docente-nombre">${_esc(doc.apellido)}, ${_esc(doc.nombre)}</span>
                    <span class="armado-docente-meta">
                      <span class="badge badge-accent">${doc.carga_horaria}hs</span>
                    </span>
                  </div>
                  <button class="btn btn-sm btn-primary armado-btn-agregar" 
                          data-docente-id="${doc.id}" 
                          data-asig-id="${doc.id_asignatura}"
                          data-docente-nombre="${_esc(doc.apellido)}, ${_esc(doc.nombre)}"
                          data-asig-nombre="${_esc(materia)}">
                    <i class="fa-solid fa-plus" aria-hidden="true"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    }

    // Construir HTML de docentes asignados
    let htmlAsignados = '';
    if (_docentesAsignadosGrupo.length === 0) {
      htmlAsignados = `
        <div class="armado-docente-vacio">
          <i class="fa-solid fa-users" aria-hidden="true"></i>
          <p>No hay docentes asignados a este grupo todavía.</p>
          <p class="text-muted text-xs">Agregá docentes desde la lista de disponibles.</p>
        </div>
      `;
    } else {
      htmlAsignados = _docentesAsignadosGrupo.map(asig => `
        <div class="armado-asignado-item" data-asig-doc-id="${asig.id_asignacion}">
          <div class="armado-asignado-info">
            <span class="armado-docente-nombre">${_esc(asig.docente_apellido)}, ${_esc(asig.docente_nombre)}</span>
            <span class="armado-asignado-asignatura">
              <i class="fa-solid fa-book" aria-hidden="true"></i>
              ${_esc(asig.asignatura_nombre)}
            </span>
            <span class="armado-asignado-meta">
              <span class="badge badge-accent">Grado ${asig.grado}</span>
              <span class="badge badge-gris">${asig.puntaje} pts</span>
            </span>
          </div>
          <button class="btn btn-sm btn-danger armado-btn-quitar" 
                  data-asig-doc-id="${asig.id_asignacion}"
                  data-docente-nombre="${_esc(asig.docente_apellido)}, ${_esc(asig.docente_nombre)}">
            <i class="fa-solid fa-minus" aria-hidden="true"></i>
          </button>
        </div>
      `).join('');
    }

    wrap.innerHTML = `
      <div class="armado-asignar-layout">
        <!-- Header -->
        <div class="armado-asignar-header">
          <button class="btn btn-ghost" id="armado-btn-volver-seleccion">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Volver
          </button>
          <div class="armado-asignar-titulo">
            <h2>Asignar Docentes al Grupo</h2>
            <p>${_esc(g.nivel_nombre)}${g.numero} — ${_esc(g.turno_nombre)}</p>
          </div>
          <button class="btn btn-primary" id="armado-btn-continuar-armado">
            Continuar al Armado
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Aviso si no hay docentes asignados -->
        ${_docentesAsignadosGrupo.length === 0 ? `
          <div class="armado-aviso" id="armado-aviso-sin-docentes">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <div>
              <strong>Sin docentes asignados</strong>
              <p>Este grupo no tiene docentes asignados. Podés continuar al armado y asignar docentes después.</p>
            </div>
          </div>
        ` : ''}

        <!-- Contenido principal -->
        <div class="armado-asignar-contenido">
          <!-- Panel izquierdo: Docentes disponibles -->
          <div class="armado-panel-disponibles">
            <div class="armado-panel-header">
              <h3>
                <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                Docentes Disponibles
              </h3>
              <input type="text" class="armado-filtro-disponibles" id="armado-filtro-disponibles"
                     placeholder="Buscar docente..." autocomplete="off" />
            </div>
            <div class="armado-panel-body" id="armado-lista-disponibles">
              ${htmlDisponibles}
            </div>
          </div>

          <!-- Panel derecho: Docentes asignados -->
          <div class="armado-panel-asignados">
            <div class="armado-panel-header">
              <h3>
                <i class="fa-solid fa-users" aria-hidden="true"></i>
                Docentes Asignados
                <span class="armado-contador-asignados">${_docentesAsignadosGrupo.length}</span>
              </h3>
            </div>
            <div class="armado-panel-body" id="armado-lista-asignados">
              ${htmlAsignados}
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind eventos
    _bindEventosAsignarDocentes();
  }

  function _bindEventosAsignarDocentes() {
    // Botón volver a selección
    document.getElementById('armado-btn-volver-seleccion')?.addEventListener('click', () => {
      document.getElementById('armado-asignar-docentes').style.display = 'none';
      document.getElementById('armado-seleccion').style.display = 'flex';
      _grupoActual = null;
      _renderizarSeleccionGrupo();
    });

    // Botón continuar al armado
    document.getElementById('armado-btn-continuar-armado')?.addEventListener('click', _continuarAlArmado);

    // Filtro de disponibles
    document.getElementById('armado-filtro-disponibles')?.addEventListener('input', _filtrarDisponibles);

    // Botones agregar
    document.querySelectorAll('.armado-btn-agregar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _agregarDocenteAlGrupo(btn);
      });
    });

    // Botones quitar
    document.querySelectorAll('.armado-btn-quitar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _quitarDocenteDelGrupo(btn);
      });
    });
  }

  function _filtrarDisponibles(e) {
    const texto = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.armado-docente-item').forEach(item => {
      const nombre = item.querySelector('.armado-docente-nombre')?.textContent.toLowerCase() || '';
      item.style.display = nombre.includes(texto) ? '' : 'none';
    });
  }

  async function _agregarDocenteAlGrupo(btn) {
    const idDocente = Number(btn.dataset.docenteId);
    const idAsignatura = Number(btn.dataset.asigId);
    const nombreDocente = btn.dataset.docenteNombre;
    const nombreAsignatura = btn.dataset.asigNombre;

    // Verificar si ya está asignado a esta materia en este grupo
    const yaAsignado = _docentesAsignadosGrupo.some(a =>
      a.id_docente === idDocente && a.id_asignatura === idAsignatura
    );

    if (yaAsignado) {
      UI.mostrarToast(`${nombreDocente} ya está asignado a ${nombreAsignatura} en este grupo.`, 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-sm"></div>';

    try {
      // Buscar el id_docente_asignatura correspondiente
      const resDA = await fetch(`${App.API_BASE}/docente_asignatura`);
      if (!resDA.ok) throw new Error('Error al obtener datos');

      const docAsig = await resDA.json();
      const relacion = docAsig.find(da =>
        da.id_docente === idDocente && da.id_asignatura === idAsignatura
      );

      if (!relacion) {
        UI.mostrarToast('No se encontró la relación docente-asignatura.', 'error');
        return;
      }

      // Crear asignación
      const res = await fetch(URL_ASIG_DOC_CREAR(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_grupo: _grupoActual.id,
          id_asignatura: idAsignatura,
          id_docente_asignatura: relacion.id
        })
      });

      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo asignar el docente.', 'error');
        return;
      }

      // Actualizar cache
      _docentesAsignadosGrupo.push({
        id_asignacion: datos.id,
        id_docente: idDocente,
        docente_nombre: nombreDocente.split(', ')[1] || '',
        docente_apellido: nombreDocente.split(', ')[0] || '',
        id_asignatura: idAsignatura,
        asignatura_nombre: nombreAsignatura,
        grado: relacion.grado,
        puntaje: relacion.puntaje,
        efectivo: relacion.efectivo
      });

      // Remover de disponibles
      _docentesDisponiblesNivel = _docentesDisponiblesNivel.filter(d => {
        if (d.id !== idDocente) return true;
        if (d.asignaturas) {
          d.asignaturas = d.asignaturas.filter(a => a.id !== idAsignatura);
          return d.asignaturas.length > 0;
        }
        return false;
      });

      // Re-renderizar
      _renderizarAsignarDocentes();

      UI.mostrarToast(`${nombreDocente} asignado a ${nombreAsignatura}.`, 'success');

    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
      // Restaurar botón
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
    }
  }

  async function _quitarDocenteDelGrupo(btn) {
    const idAsignacion = Number(btn.dataset.asigDocId);
    const nombreDocente = btn.dataset.docenteNombre;

    const confirmado = await UI.confirmar(
      'Quitar docente del grupo',
      `¿Estás seguro de querer quitar a ${nombreDocente} de este grupo?`,
      { labelConfirmar: 'Quitar', variante: 'danger' }
    );

    if (!confirmado) return;

    btn.disabled = true;

    try {
      const res = await fetch(URL_ASIG_DOC_ELIMINAR(idAsignacion), { method: 'DELETE' });

      if (!res.ok) {
        const datos = await res.json();
        UI.mostrarToast(datos.error || 'No se pudo quitar el docente.', 'error');
        return;
      }

      // Actualizar cache
      const eliminada = _docentesAsignadosGrupo.find(a => a.id_asignacion === idAsignacion);
      _docentesAsignadosGrupo = _docentesAsignadosGrupo.filter(a => a.id_asignacion !== idAsignacion);

      // Recargar disponibles
      const rDisponibles = await fetch(URL_DISPONIBLES_GRUPO(_grupoActual.id));
      if (rDisponibles.ok) {
        _docentesDisponiblesNivel = await rDisponibles.json();
      }

      // Re-renderizar
      _renderizarAsignarDocentes();

      UI.mostrarToast(`${nombreDocente} removido del grupo.`, 'success');

    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
    }
  }

  async function _continuarAlArmado() {
    // Ocultar asignación, mostrar editor
    document.getElementById('armado-asignar-docentes').style.display = 'none';
    const editor = document.getElementById('armado-editor');
    editor.style.display = 'flex';

    UI.mostrarCargando(editor, 'Cargando horario del grupo...');

    try {
      // Cargar docentes y horario
      const [rDocentes, rHorario] = await Promise.all([
        fetch(URL_DOCENTES()),
        fetch(URL_HORARIO_GRUPO(_grupoActual.id)),
      ]);

      if (!rDocentes.ok || !rHorario.ok) {
        throw new Error('Error al cargar datos del grupo');
      }

      _docentes = await rDocentes.json();
      _horarioGrupo = await rHorario.json();

      // Filtrar solo docentes asignados al grupo
      const idsDocentesAsignados = new Set(_docentesAsignadosGrupo.map(a => a.id_docente));
      _docentes = _docentes.filter(d => idsDocentesAsignados.has(d.id));

      // Cargar asignaturas de cada docente en paralelo
      await _cargarAsignaturasDocentes();

      _renderizarEditor();
    } catch (error) {
      UI.renderizarVacio(
        editor,
        'fa-solid fa-triangle-exclamation',
        'No se pudo cargar el grupo',
        UI.mensajeError(error)
      );
    }
  }

  // ════════════════════════════════════════════════════════════
  //  7.1.2 PANEL SUPERIOR — INFO DEL GRUPO
  // ════════════════════════════════════════════════════════════

  function _renderizarPanelInfo() {
    const g = _grupoActual;
    if (!g) return '';

    // Calcular horas asignadas del grupo
    const totalHoras = _horarioGrupo.length;

    return `
      <div class="panel-info-grupo">
        <div class="panel-info-grupo-left">
          <button class="btn btn-ghost btn-sm" id="armado-btn-volver" title="Volver a selección de grupo">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <h2 class="grupo-titulo">${_esc(g.nivel_nombre)}${g.numero}</h2>
          <div class="grupo-chips">
            <span class="grupo-chip grupo-chip-nivel">
              <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
              ${_esc(g.nivel_nombre)}
            </span>
            <span class="grupo-chip grupo-chip-turno">
              <i class="fa-solid fa-clock" aria-hidden="true"></i>
              ${_esc(g.turno_nombre)}
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="armado-btn-consultar-disp" title="Abrir disponibilidad de docentes en pestaña separada para trabajar con dos pantallas">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            Consultar disponibilidades
          </button>
          <div class="grupo-horas-resumen">
            <div class="hora-stat">
              <span class="hora-stat-valor" id="armado-horas-asignadas">${totalHoras}</span>
              <span class="hora-stat-label">Asignadas</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  7.1.3 PANEL IZQUIERDO — GRILLA SEMANAL
  // ════════════════════════════════════════════════════════════

  function _renderizarGrilla() {
    if (_horasTurno.length === 0) {
      return `
        <div class="panel-grilla">
          <div class="panel-grilla-header">
            <span class="panel-grilla-titulo">Grilla Semanal</span>
          </div>
          <div class="estado-vacio">
            <i class="fa-solid fa-clock" aria-hidden="true"></i>
            <h3>Sin horas configuradas</h3>
            <p>El turno de este grupo no tiene horas configuradas. Editá el turno primero.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="panel-grilla">
        <div class="panel-grilla-header">
          <span class="panel-grilla-titulo">
            <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
            Grilla Semanal
          </span>
        </div>
        <div class="tabla-horario-wrap">
          <table class="tabla-horario">
            <thead>
              <tr>
                <th class="col-hora">Hora</th>
                ${DIAS.map(d => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${_renderizarFilasGrilla()}
            </tbody>
          </table>
        </div>
        ${_renderizarLeyenda()}
      </div>
    `;
  }

  function _obtenerAsignacionesCelda(dia, hora) {
    return _horarioGrupo.filter(h =>
      h.dia_semana === dia && h.numero_hora === hora
    );
  }

  function _obtenerClaseCelda(asignaciones) {
    if (asignaciones.length === 0) return 'vacia';
    if (asignaciones.length === 2) return 'dupla';
    return 'ocupado-liceo';
  }

  function _renderizarContenidoCelda(asignaciones, dia, hora) {
    if (asignaciones.length === 0) {
      return `<i class="fa-solid fa-plus celda-add-icon" aria-hidden="true"></i>`;
    }

    if (asignaciones.length === 1) {
      const a = asignaciones[0];
      return `
        <div class="celda-asignacion">
          <span class="celda-asignatura">${_esc(a.asignatura_nombre)}</span>
          <span class="celda-docente">${_esc(a.docente_apellido)}, ${_esc(a.docente_nombre)}</span>
        </div>
        <button class="celda-btn-eliminar" data-hg-id="${a.id}" title="Eliminar asignación" aria-label="Eliminar asignación">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `;
    }

    // Dupla (2 asignaturas)
    return `
      <span class="celda-dupla-badge">DUPLA</span>
      ${asignaciones.map(a => `
        <div class="celda-dupla-item">
          <span class="celda-asignatura">${_esc(a.asignatura_nombre)}</span>
          <span class="celda-docente">${_esc(a.docente_apellido)}</span>
        </div>
      `).join('')}
      <button class="celda-btn-eliminar" data-hg-id="${asignaciones.map(a => a.id).join(',')}" title="Eliminar asignaciones" aria-label="Eliminar asignaciones">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    `;
  }

  function _renderizarLeyenda() {
    return `
      <div class="leyenda-colores">
        <span class="leyenda-item">
          <span class="leyenda-dot leyenda-dot-vacio"></span>
          Vacía
        </span>
        <span class="leyenda-item">
          <span class="leyenda-dot leyenda-dot-liceo"></span>
          Asignada
        </span>
        <span class="leyenda-item">
          <span class="leyenda-dot" style="background:rgba(234,179,8,0.8)"></span>
          Dupla
        </span>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  7.1.4 PANEL DERECHO — LISTA DE DOCENTES (solo asignados al grupo)
  // ════════════════════════════════════════════════════════════

  function _renderizarPanelDocentes() {
    // Filtrar docentes que estén asignados al grupo
    const idsDocentesAsignados = new Set(_docentesAsignadosGrupo.map(a => a.id_docente));
    const docentesDelGrupo = _docentes.filter(doc => idsDocentesAsignados.has(doc.id));

    // Ordenar por grado (desc), luego puntaje (desc)
    docentesDelGrupo.sort((a, b) => {
      const asigsA = _asignacionesDocente[a.id] || [];
      const asigsB = _asignacionesDocente[b.id] || [];

      const mejorA = asigsA
        .filter(a => a.id_nivel === _grupoActual?.id_nivel)
        .sort((x, y) => (y.grado - x.grado) || (y.puntaje - x.puntaje))[0];
      const mejorB = asigsB
        .filter(a => a.id_nivel === _grupoActual?.id_nivel)
        .sort((x, y) => (y.grado - x.grado) || (y.puntaje - x.puntaje))[0];

      const gradoA = mejorA?.grado || 0;
      const gradoB = mejorB?.grado || 0;
      if (gradoB !== gradoA) return gradoB - gradoA;

      const puntajeA = mejorA?.puntaje || 0;
      const puntajeB = mejorB?.puntaje || 0;
      return puntajeB - puntajeA;
    });

    let listaHTML = '';
    if (docentesDelGrupo.length === 0) {
      listaHTML = `
        <div class="estado-vacio" style="padding:2rem 1rem;">
          <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
          <h3 style="font-size:var(--text-sm);margin-bottom:0.5rem;">Sin docentes asignados</h3>
          <p style="font-size:var(--text-xs);">No hay docentes asignados a este grupo.</p>
          <button class="btn btn-secondary btn-sm" id="armado-btn-asignar-docentes" style="margin-top:1rem;">
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
            Asignar docentes
          </button>
        </div>
      `;
    } else {
      listaHTML = docentesDelGrupo.map(doc => {
        const asigs = (_asignacionesDocente[doc.id] || [])
          .filter(a => a.id_nivel === _grupoActual?.id_nivel);

        const horasAsignadasEnGrupo = _horarioGrupo.filter(h => h.id_docente === doc.id).length;
        const horasTotalesDocente = asigs.reduce((sum, a) => sum + (a.carga_horaria || 0), 0);

        return `
          <div class="docente-card" data-docente-id="${doc.id}" data-asignaturas='${_esc(JSON.stringify(asigs))}'>
            <div class="docente-card-top">
              <span class="docente-card-nombre">${_esc(doc.apellido)}, ${_esc(doc.nombre)}</span>
              ${asigs.length > 0 ? `<span class="docente-card-grado">${asigs[0].grado}</span>` : ''}
            </div>
            <div class="docente-card-asignatura">
              ${asigs.map(a => a.asignatura_nombre).join(', ')}
            </div>
            <div class="docente-horas">
              <div class="docente-horas-info">
                <span class="docente-horas-texto">${horasAsignadasEnGrupo} / ${horasTotalesDocente} hs</span>
                <span class="docente-horas-restantes ${horasAsignadasEnGrupo >= horasTotalesDocente ? 'cero' : ''}">
                  ${horasTotalesDocente - horasAsignadasEnGrupo} restantes
                </span>
              </div>
              <div class="docente-barra">
                <div class="docente-barra-fill ${horasAsignadasEnGrupo >= horasTotalesDocente ? 'llena' : ''}"
                     style="width: ${horasTotalesDocente > 0 ? Math.min(100, (horasAsignadasEnGrupo / horasTotalesDocente) * 100) : 0}%">
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="panel-docentes">
        <div class="panel-docentes-header">
          <span class="panel-docentes-titulo">
            <i class="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
            Docentes
          </span>
          <button class="btn btn-ghost btn-sm" id="armado-btn-admin-docentes" title="Administrar docentes del grupo">
            <i class="fa-solid fa-user-gear" aria-hidden="true"></i>
          </button>
          <input type="text" class="panel-docentes-filtro" id="armado-filtro-docente"
                 placeholder="Buscar docente..." autocomplete="off" />
        </div>
        <div class="lista-docentes" id="armado-lista-docentes">
          ${listaHTML}
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════
  //  RENDERIZADO COMPLETO DEL EDITOR
  // ════════════════════════════════════════════════════════════

  function _renderizarEditor() {
    const editor = document.getElementById('armado-editor');
    if (!editor) return;

    editor.innerHTML = `
      ${_renderizarPanelInfo()}
      <div class="horario-contenido">
        ${_renderizarGrilla()}
        ${_renderizarPanelDocentes()}
      </div>
    `;

    // Eventos
    _bindEventos();
  }

  // ════════════════════════════════════════════════════════════
  //  EVENTOS
  // ════════════════════════════════════════════════════════════

  function _bindEventos() {
    // Botón volver
    document.getElementById('armado-btn-volver')?.addEventListener('click', _volverASeleccion);

    // Botón consultar disponibilidades en pestaña separada
    document.getElementById('armado-btn-consultar-disp')?.addEventListener('click', () => {
      if (_grupoActual?.id) {
        window.open(`consulta_disponibilidad.html?id_grupo=${_grupoActual.id}`, '_blank');
      }
    });

    // Botón administrar docentes
    document.getElementById('armado-btn-admin-docentes')?.addEventListener('click', () => {
      _volverAAsignarDocentes();
    });

    // Botón asignar docentes (cuando no hay)
    document.getElementById('armado-btn-asignar-docentes')?.addEventListener('click', () => {
      _volverAAsignarDocentes();
    });

    // Filtro de docentes
    document.getElementById('armado-filtro-docente')?.addEventListener('input', _filtrarDocentes);

    // Click en celdas de la grilla
    document.querySelectorAll('.celda-horario').forEach(celda => {
      celda.addEventListener('click', _manejarClickCelda);
    });

    // Click en botones eliminar de celdas
    document.querySelectorAll('.celda-btn-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _manejarEliminarAsignacion(btn.dataset.hgId);
      });
    });

    // Click en docentes
    document.querySelectorAll('.docente-card').forEach(card => {
      card.addEventListener('click', () => _seleccionarDocente(card));
    });
  }

  async function _volverAAsignarDocentes() {
    // Ocultar editor, mostrar asignación
    document.getElementById('armado-editor').style.display = 'none';
    const asignarDocentes = document.getElementById('armado-asignar-docentes');
    asignarDocentes.style.display = 'block';

    UI.mostrarCargando(asignarDocentes, 'Actualizando lista de docentes...');

    try {
      // Recargar datos
      const [rAsignados, rDisponibles] = await Promise.all([
        fetch(URL_ASIG_DOC_GRUPO(_grupoActual.id)),
        fetch(URL_DISPONIBLES_GRUPO(_grupoActual.id)),
      ]);

      if (!rAsignados.ok || !rDisponibles.ok) {
        throw new Error('Error al cargar datos');
      }

      _docentesAsignadosGrupo = await rAsignados.json();
      _docentesDisponiblesNivel = await rDisponibles.json();

      _renderizarAsignarDocentes();
    } catch (error) {
      UI.renderizarVacio(
        asignarDocentes,
        'fa-solid fa-triangle-exclamation',
        'No se pudo cargar la información',
        UI.mensajeError(error)
      );
    }
  }

  function _volverASeleccion() {
    document.getElementById('armado-seleccion').style.display = 'flex';
    document.getElementById('armado-editor').style.display = 'none';
    _grupoActual = null;
    _horarioGrupo = [];
    _renderizarSeleccionGrupo();
  }

  function _filtrarDocentes(e) {
    const texto = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.docente-card');

    cards.forEach(card => {
      const nombre = card.querySelector('.docente-card-nombre')?.textContent.toLowerCase() || '';
      const asignatura = card.querySelector('.docente-card-asignatura')?.textContent.toLowerCase() || '';
      const visible = nombre.includes(texto) || asignatura.includes(texto);
      card.style.display = visible ? '' : 'none';
    });
  }

  // ════════════════════════════════════════════════════════════
  //  7.2.1 SELECCIÓN DE DOCENTE PARA ASIGNAR
  // ════════════════════════════════════════════════════════════

  function _seleccionarDocente(card) {
    const docenteId = Number(card.dataset.docenteId);
    const docente = _docentes.find(d => d.id === docenteId);

    if (!docente) return;

    // Si ya está seleccionado, deseleccionar
    if (_docenteSeleccionado?.id === docenteId) {
      _deseleccionarDocente();
      return;
    }

    // Quitar selección anterior
    document.querySelectorAll('.docente-card.seleccionado').forEach(c => {
      c.classList.remove('seleccionado');
    });

    // Seleccionar nuevo docente
    _docenteSeleccionado = docente;

    // Obtener asignaturas del docente para este nivel
    const asigsNivel = (_asignacionesDocente[docenteId] || [])
      .filter(a => a.id_nivel === _grupoActual?.id_nivel);

    // Si tiene una sola asignatura, seleccionarla automáticamente
    if (asigsNivel.length === 1) {
      _asignaturaSeleccionada = asigsNivel[0];
    } else if (asigsNivel.length > 1) {
      // Si tiene múltiples, mostrar selector
      _mostrarSelectorAsignatura(docente, asigsNivel);
      return;
    } else {
      UI.mostrarToast('Este docente no tiene asignaturas para este nivel.', 'warning');
      return;
    }

    // Marcar como seleccionado
    card.classList.add('seleccionado');

    // Resaltar celdas donde se puede asignar
    _resaltarCeldasDisponibles();

    UI.mostrarToast(`Docente seleccionado: ${docente.apellido}. Click en una celda vacía.`, 'info');
  }

  function _deseleccionarDocente() {
    _docenteSeleccionado = null;
    _asignaturaSeleccionada = null;

    document.querySelectorAll('.docente-card.seleccionado').forEach(c => {
      c.classList.remove('seleccionado');
    });

    document.querySelectorAll('.celda-horario.seleccionada').forEach(c => {
      c.classList.remove('seleccionada');
    });
  }

  function _mostrarSelectorAsignatura(docente, asignaturas) {
    // Crear modal para seleccionar asignatura
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const opcionesHTML = asignaturas.map(a => `
      <button class="btn btn-secondary armado-asig-opcion" data-asig-id="${a.id}" style="width:100%;justify-content:flex-start;text-align:left;">
        <span>${_esc(a.asignatura_nombre)}</span>
        <span class="text-muted text-xs" style="margin-left:auto;">${a.carga_horaria}hs</span>
      </button>
    `).join('');

    overlay.innerHTML = `
      <div class="modal-card" style="max-width:380px;">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:.65rem;">
            <i class="fa-solid fa-book" style="color:var(--accent-hover);" aria-hidden="true"></i>
            <span class="modal-titulo">Seleccionar Asignatura</span>
          </div>
          <button class="modal-cerrar" id="armado-modal-cerrar" aria-label="Cerrar">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:1rem;">
            ${_esc(docente.apellido)}, ${_esc(docente.nombre)} dicta varias asignaturas. Elegí cuál asignar:
          </p>
          <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${opcionesHTML}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Eventos
    overlay.querySelector('#armado-modal-cerrar')?.addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelectorAll('.armado-asig-opcion').forEach(btn => {
      btn.addEventListener('click', () => {
        const idAsig = Number(btn.dataset.asigId);
        _asignaturaSeleccionada = asignaturas.find(a => a.id === idAsig);

        // Marcar docente como seleccionado
        document.querySelectorAll('.docente-card.seleccionado').forEach(c => {
          c.classList.remove('seleccionado');
        });
        const cardDocente = document.querySelector(`.docente-card[data-docente-id="${docente.id}"]`);
        cardDocente?.classList.add('seleccionado');

        _resaltarCeldasDisponibles();
        overlay.remove();

        UI.mostrarToast(`Asignatura seleccionada: ${_asignaturaSeleccionada.asignatura_nombre}. Click en una celda vacía.`, 'info');
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function _resaltarCeldasDisponibles() {
    // Remover resaltado anterior
    document.querySelectorAll('.celda-horario.seleccionada').forEach(c => {
      c.classList.remove('seleccionada');
    });

    // Resaltar celdas vacías donde se puede asignar
    document.querySelectorAll('.celda-horario').forEach(celda => {
      const dia = Number(celda.dataset.dia);
      const hora = Number(celda.dataset.hora);
      const asignaciones = _obtenerAsignacionesCelda(dia, hora);

      // Solo resaltar celdas vacías o con una asignación (para dupla)
      if (asignaciones.length < 2) {
        celda.classList.add('seleccionada');
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  //  7.2.1 CLICK EN CELDA — ASIGNAR DOCENTE
  // ════════════════════════════════════════════════════════════

  async function _manejarClickCelda(e) {
    if (!_docenteSeleccionado || !_asignaturaSeleccionada) return;

    const celda = e.currentTarget;
    const dia = Number(celda.dataset.dia);
    const hora = Number(celda.dataset.hora);

    // Verificar si se puede asignar
    const asignaciones = _obtenerAsignacionesCelda(dia, hora);

    if (asignaciones.length >= 2) {
      UI.mostrarToast('Esta celda ya tiene 2 asignaturas (dupla completa).', 'warning');
      return;
    }

    // Verificar si el docente ya está en esa celda
    const docenteEnCelda = asignaciones.some(a => a.id_docente === _docenteSeleccionado.id);
    if (docenteEnCelda) {
      UI.mostrarToast('Este docente ya está asignado en esta celda.', 'warning');
      return;
    }

    // Verificar si hay conflicto de horario con otro grupo
    const conflictoOtroGrupo = await _verificarConflictoExterno(_docenteSeleccionado.id, dia, hora);
    if (conflictoOtroGrupo) {
      UI.mostrarToast(conflictoOtroGrupo, 'error');
      return;
    }

    // Determinar orden de dupla
    const ordenDupla = asignaciones.length === 0 ? 1 : 2;

    // Asignar
    await _asignarDocente(dia, hora, ordenDupla);
  }

  async function _verificarConflictoExterno(idDocente, dia, hora) {
    try {
      if (!_grupoActual || !_grupoActual.id_turno) return null;

      // Verificar disponibilidad del docente (otra institución en el turno del grupo actual)
      const res = await fetch(`${App.API_BASE}/disponibilidad/por_docente_turno/${idDocente}/${_grupoActual.id_turno}`);
      if (!res.ok) return null;

      const disponibilidad = await res.json();
      const ocupado = disponibilidad.find(d =>
        d.dia_semana === dia &&
        d.numero_hora === hora &&
        d.ocupado === true
      );

      if (ocupado) {
        return 'El docente está ocupado en otra institución en ese horario.';
      }

      return null;
    } catch {
      return null;
    }
  }

  async function _asignarDocente(dia, hora, ordenDupla) {
    try {
      // Necesitamos el id_grupo_docente (asignacion_docente)
      const idGrupoDocente = await _obtenerIdGrupoDocente(
        _docenteSeleccionado.id,
        _asignaturaSeleccionada.id_asignatura
      );

      if (!idGrupoDocente) {
        UI.mostrarToast('No se encontró la asignación de docente para esta materia.', 'error');
        return;
      }

      const res = await fetch(URL_INSERTAR(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_grupo: _grupoActual.id,
          dia_semana: dia,
          numero_hora: hora,
          id_grupo_docente: idGrupoDocente,
          orden_dupla: ordenDupla
        })
      });

      const datos = await res.json();

      if (!res.ok) {
        UI.mostrarToast(datos.error || 'No se pudo asignar el docente.', 'error');
        return;
      }

      // Actualizar caché local
      const nuevaAsignacion = {
        ...datos,
        id_docente: _docenteSeleccionado.id,
        docente_nombre: _docenteSeleccionado.nombre,
        docente_apellido: _docenteSeleccionado.apellido,
        asignatura_nombre: _asignaturaSeleccionada.asignatura_nombre,
        id_asignatura: _asignaturaSeleccionada.id_asignatura
      };
      _horarioGrupo.push(nuevaAsignacion);

      // Actualizar interfaz
      _actualizarInterfaz();

      const diaNombre = DIAS[dia - 1];
      UI.mostrarToast(
        `${_asignaturaSeleccionada.asignatura_nombre} asignada el ${diaNombre} hora ${hora}.`,
        'success'
      );

      // Deseleccionar después de asignar
      _deseleccionarDocente();

    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
    }
  }

  async function _obtenerIdGrupoDocente(idDocente, idAsignatura) {
    try {
      // Buscar en docente_asignatura la relación docente-asignatura
      const resDA = await fetch(`${App.API_BASE}/docente_asignatura`);
      if (!resDA.ok) return null;

      const docAsig = await resDA.json();
      const relacion = docAsig.find(da =>
        da.id_docente === idDocente && da.id_asignatura === idAsignatura
      );

      if (!relacion) return null;

      // Buscar en asignacion_docente la asignación para este grupo
      const resAD = await fetch(`${App.API_BASE}/asignacion_docente`);
      if (!resAD.ok) return null;

      const asignaciones = await resAD.json();
      const asignacion = asignaciones.find(a =>
        a.id_grupo === _grupoActual.id && a.id_docente_asignatura === relacion.id
      );

      if (asignacion) {
        return asignacion.id;
      }

      // Si no existe, crear la asignación de docente para este grupo
      const resCrear = await fetch(`${App.API_BASE}/asignacion_docente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_grupo: _grupoActual.id,
          id_asignatura: idAsignatura,
          id_docente_asignatura: relacion.id
        })
      });

      if (!resCrear.ok) return null;

      const nuevaAsignacion = await resCrear.json();
      return nuevaAsignacion.id;
    } catch {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  7.2.2 ELIMINAR ASIGNACIÓN DESDE LA CELDA
  // ════════════════════════════════════════════════════════════

  async function _manejarEliminarAsignacion(ids) {
    if (!ids) return;

    const idsArray = ids.split(',').map(Number);

    const confirmado = await UI.confirmar(
      'Eliminar asignación',
      `¿Estás seguro de querer eliminar ${idsArray.length > 1 ? 'estas asignaciones' : 'esta asignación'} del horario?`,
      { labelConfirmar: 'Eliminar', variante: 'danger' }
    );

    if (!confirmado) return;

    try {
      // Eliminar cada asignación
      for (const id of idsArray) {
        const res = await fetch(URL_ELIMINAR(id), { method: 'DELETE' });
        if (!res.ok) {
          const datos = await res.json();
          UI.mostrarToast(datos.error || 'No se pudo eliminar la asignación.', 'error');
          continue;
        }
      }

      // Actualizar caché local
      _horarioGrupo = _horarioGrupo.filter(h => !idsArray.includes(h.id));

      // Actualizar interfaz
      _actualizarInterfaz();

      UI.mostrarToast('Asignación(es) eliminada(s) correctamente.', 'success');

    } catch (error) {
      UI.mostrarToast('Error al conectar con el servidor.', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  7.2.4 ACTUALIZACIÓN AUTOMÁTICA DE CONTADORES
  // ════════════════════════════════════════════════════════════

  function _actualizarInterfaz() {
    // Actualizar panel de info (horas asignadas)
    const elHorasAsignadas = document.getElementById('armado-horas-asignadas');
    if (elHorasAsignadas) {
      elHorasAsignadas.textContent = _horarioGrupo.length;
    }

    // Actualizar solo el contenido de la grilla (sin reemplazar todo el panel)
    const tbody = document.querySelector('.tabla-horario tbody');
    if (tbody) {
      tbody.innerHTML = _renderizarFilasGrilla();
    }

    // Re-bind eventos de la grilla
    document.querySelectorAll('.celda-horario').forEach(celda => {
      celda.addEventListener('click', _manejarClickCelda);
    });

    document.querySelectorAll('.celda-btn-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _manejarEliminarAsignacion(btn.dataset.hgId);
      });
    });

    // Actualizar panel de docentes (horas asignadas/restantes)
    _actualizarPanelDocentes();
  }

  function _renderizarFilasGrilla() {
    // Ordenar horas por número
    const horasOrdenadas = [..._horasTurno].sort((a, b) => a.numero_hora - b.numero_hora);

    let filasHTML = '';
    horasOrdenadas.forEach(hora => {
      let celdasHTML = '';
      DIAS.forEach((dia, idxDia) => {
        const diaSemana = idxDia + 1;
        const asignaciones = _obtenerAsignacionesCelda(diaSemana, hora.numero_hora);
        const claseCelda = _obtenerClaseCelda(asignaciones);
        const contenidoCelda = _renderizarContenidoCelda(asignaciones, diaSemana, hora.numero_hora);

        celdasHTML += `
          <td class="celda-horario" data-dia="${diaSemana}" data-hora="${hora.numero_hora}">
            <div class="celda-inner ${claseCelda}">
              ${contenidoCelda}
            </div>
          </td>
        `;
      });

      filasHTML += `
        <tr>
          <td class="col-hora">
            <span class="col-hora-numero">${hora.numero_hora}</span>
            <span class="col-hora-tiempo">${_esc(hora.hora_inicio || '')} - ${_esc(hora.hora_fin || '')}</span>
          </td>
          ${celdasHTML}
        </tr>
      `;
    });

    return filasHTML;
  }

  function _actualizarPanelDocentes() {
    const idNivelGrupo = _grupoActual?.id_nivel;

    document.querySelectorAll('.docente-card').forEach(card => {
      const docenteId = Number(card.dataset.docenteId);

      // Calcular horas asignadas del docente en este grupo
      const horasAsignadasEnGrupo = _horarioGrupo.filter(h => h.id_docente === docenteId).length;

      // Obtener asignaturas del docente para este nivel
      const asigs = (_asignacionesDocente[docenteId] || [])
        .filter(a => a.id_nivel === idNivelGrupo);

      const horasTotalesDocente = asigs.reduce((sum, a) => sum + (a.carga_horaria || 0), 0);
      const restantes = Math.max(0, horasTotalesDocente - horasAsignadasEnGrupo);

      // Actualizar texto de horas
      const horasTexto = card.querySelector('.docente-horas-texto');
      if (horasTexto) {
        horasTexto.textContent = `${horasAsignadasEnGrupo} / ${horasTotalesDocente} hs`;
      }

      // Actualizar horas restantes
      const horasRestantes = card.querySelector('.docente-horas-restantes');
      if (horasRestantes) {
        horasRestantes.textContent = `${restantes} restantes`;
        horasRestantes.classList.toggle('cero', restantes === 0);
      }

      // Actualizar barra de progreso
      const barraFill = card.querySelector('.docente-barra-fill');
      if (barraFill) {
        const porcentaje = horasTotalesDocente > 0
          ? Math.min(100, (horasAsignadasEnGrupo / horasTotalesDocente) * 100)
          : 0;
        barraFill.style.width = `${porcentaje}%`;
        barraFill.classList.toggle('llena', horasAsignadasEnGrupo >= horasTotalesDocente);
      }

      // Actualizar estado del card
      card.classList.toggle('sin-horas', restantes === 0);
    });
  }

  // ════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════

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
    if (document.getElementById('style-modulo-armado')) return;

    const style = document.createElement('style');
    style.id = 'style-modulo-armado';
    style.textContent = `
      /* Sección de nivel en la selección de grupo */
      .armado-nivel-seccion {
        width: 100%;
        max-width: 800px;
      }

      .armado-nivel-titulo {
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
        padding-left: 0.25rem;
      }

      /* Botón volver */
      #armado-btn-volver {
        margin-right: 0.5rem;
      }

      /* ═══════════════════════════════════════════════════════ */
      /*  Pantalla Asignar Docentes al Grupo (7.2B)            */
      /* ═══════════════════════════════════════════════════════ */

      .armado-asignar-layout {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
        animation: slideUp 0.3s ease;
      }

      .armado-asignar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
        flex-wrap: wrap;
      }

      .armado-asignar-titulo {
        text-align: center;
        flex: 1;
      }

      .armado-asignar-titulo h2 {
        font-size: var(--text-lg);
        font-weight: 700;
        color: var(--text);
        margin-bottom: 0.15rem;
      }

      .armado-asignar-titulo p {
        font-size: var(--text-sm);
        color: var(--text-muted);
      }

      /* Aviso de sin docentes */
      .armado-aviso {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        background: var(--warning-bg);
        border: 1px solid var(--warning-border);
        border-radius: var(--radius-md);
        animation: slideDown 0.3s ease;
      }

      .armado-aviso i {
        color: var(--warning);
        font-size: 1.1rem;
        margin-top: 0.1rem;
        flex-shrink: 0;
      }

      .armado-aviso strong {
        color: var(--warning-text);
        font-size: var(--text-sm);
        display: block;
        margin-bottom: 0.25rem;
      }

      .armado-aviso p {
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin: 0;
      }

      /* Contenido principal */
      .armado-asignar-contenido {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        flex: 1;
        min-height: 0;
      }

      /* Paneles */
      .armado-panel-disponibles,
      .armado-panel-asignados {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .armado-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--glass-border);
        background: rgba(255, 255, 255, 0.02);
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .armado-panel-header h3 {
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .armado-contador-asignados {
        background: var(--accent-subtle);
        color: var(--accent-hover);
        padding: 0.1rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: 700;
      }

      .armado-filtro-disponibles {
        width: 100%;
        padding: 0.45rem 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--glass-border-h);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-size: var(--text-sm);
        font-family: var(--font);
        outline: none;
        transition: border-color var(--transition), box-shadow var(--transition);
      }

      .armado-filtro-disponibles::placeholder {
        color: var(--text-faint);
      }

      .armado-filtro-disponibles:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
      }

      .armado-panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem;
      }

      /* Grupo de materia */
      .armado-materia-grupo {
        margin-bottom: 1rem;
      }

      .armado-materia-grupo:last-child {
        margin-bottom: 0;
      }

      .armado-materia-titulo {
        font-size: var(--text-xs);
        font-weight: 700;
        color: var(--accent-hover);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .armado-materia-titulo i {
        font-size: 0.75em;
      }

      /* Lista de docentes */
      .armado-docentes-lista {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .armado-docente-item,
      .armado-asignado-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.6rem 0.75rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-sm);
        transition: background var(--transition), border-color var(--transition);
      }

      .armado-docente-item:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--glass-border-h);
      }

      .armado-docente-info,
      .armado-asignado-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
        flex: 1;
      }

      .armado-docente-nombre {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .armado-docente-meta,
      .armado-asignado-meta {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
      }

      .armado-asignado-asignatura {
        font-size: var(--text-xs);
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }

      /* Estado vacío */
      .armado-docente-vacio {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 2rem 1rem;
        text-align: center;
        color: var(--text-muted);
      }

      .armado-docente-vacio i {
        font-size: 2rem;
        color: rgba(148, 163, 184, 0.2);
      }

      .armado-docente-vacio p {
        font-size: var(--text-sm);
        margin: 0;
      }

      /* Botones de acción */
      .armado-btn-agregar,
      .armado-btn-quitar {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Ajuste para el panel de info en mobile */
      @media (max-width: 768px) {
        .horario-contenido,
        .armado-asignar-contenido {
          grid-template-columns: 1fr;
        }

        .panel-docentes,
        .armado-panel-disponibles,
        .armado-panel-asignados {
          max-height: 300px;
        }

        .armado-asignar-header {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Inyectar estilos al cargar el módulo
  _inyectarEstilos();

  // ── API Pública ──────────────────────────────────────────────
  return { render };

})();
