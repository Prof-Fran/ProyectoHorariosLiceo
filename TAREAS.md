# ✅ Tareas y Funcionalidades — Sistema de Armado de Horarios

> **Leyenda de estados:**
> - `[ ]` — No iniciada
> - `[/]` — En proceso
> - `[x]` — Completada

---

## 🏗️ FASE 1 — Setup del Proyecto y Arquitectura

- [x] Decidir estrategia de conexión a PostgreSQL (Node.js local Express + `pg`)
- [x] Crear estructura modular de carpetas (`css/`, `js/`, `modulos/`, `server/`, `server/routes/`, `sql/`, `docs/`)
- [x] Configurar `package.json` y dependencias (`express`, `pg`, `cors`)
- [x] Configurar pool de conexiones resiliente en `server/db.js`
- [x] Servir estáticos del frontend directamente desde Express (`server.js`)
- [x] Verificar instalación y conectividad de PostgreSQL local

---

## 🗄️ FASE 2 — Base de Datos y Modelo Relacional

- [x] Crear el esquema SQL completo (`sql/esquema.sql`):
  - [x] Tabla `niveles` (identificador, nombre de nivel)
  - [x] Tabla `turnos` (identificador, nombre de turno)
  - [x] Tabla `horarios_turno` (turno, número de hora, hora inicio, hora fin)
  - [x] Tabla `grupos` (nivel, turno, número/nombre)
  - [x] Tabla `asignaturas` (nivel, nombre, carga horaria semanal)
  - [x] Tabla `docentes` (nombre, apellido, cédula)
  - [x] Tabla `docente_asignatura` (relación docente-materia con grado 1–7, puntaje y condición de efectividad)
  - [x] Tabla `grupo_asignatura` (malla curricular de materias por grupo)
  - [x] Tabla `asignacion_docente` (docentes designados por grupo y materia, con soporte para duplas/taller)
  - [x] Tabla `disponibilidad_docente` (bloques ocupados por docente en otras instituciones)
  - [x] Tabla `horario_grupo` (grilla horaria final: grupo, docente/asignatura, día, número de hora)
- [x] Definir claves foráneas, índices de rendimiento y restricciones de integridad (`UNIQUE`, `CHECK`, `NOT NULL`, eliminación controlada)
- [x] Crear vistas SQL especializadas para optimizar consultas (`sql/vistas.sql`):
  - [x] `vista_docentes_por_asignatura`: Ordenados por escalafón oficial (Efectivo > Grado DESC > Puntaje DESC)
  - [x] `vista_horas_grupo`: Contador dinámico de horas asignadas vs. restantes por materia y grupo
  - [x] `vista_docente_ocupado`: Unificación de conflictos externos (otra institución) e internos (otras clases en el liceo)
- [x] Crear datos iniciales y de prueba (`sql/datos_iniciales.sql`) con niveles (7°, 8°, 9°, EMS) y turnos (Matutino, Vespertino, Nocturno)

---

## 🔌 FASE 3 — Backend / API REST Local (`server/`)

- [x] Servidor Node.js con Express en `server/server.js` (puerto 3000)
- [x] Middleware CORS habilitado y parser JSON
- [x] Endpoint de verificación de estado: `GET /api/estado`
- [x] Endpoints CRUD modulares en `server/routes/`:
  - [x] `/api/niveles` — CRUD completo con validación de dependencias
  - [x] `/api/turnos` — CRUD de turnos
  - [x] `/api/horarios_turno` — CRUD y consulta por turno (`/por_turno/:id_turno`)
  - [x] `/api/grupos` — CRUD con datos consolidados de nivel y turno
  - [x] `/api/asignaturas` — CRUD con filtrado por nivel
  - [x] `/api/docentes` — CRUD de docentes
  - [x] `/api/docente_asignatura` — Gestión de habilitación docente por materia (grado, puntaje, efectividad)
  - [x] `/api/grupo_asignatura` — Asignación de materias a grupos
  - [x] `/api/asignacion_docente` — Designación de docentes a grupos:
    - [x] `GET /estructura_completa/:id_grupo` (estructura integral para el módulo de asignación)
    - [x] `GET /por_grupo_con_detalle/:id_grupo`
    - [x] `GET /disponibles_grupo/:id_grupo`
    - [x] `POST /` y `DELETE /:id`
  - [x] `/api/disponibilidad` — Gestión de disponibilidad docente:
    - [x] `GET /docente/:id_docente/turno/:id_turno`
    - [x] `POST /guardar_turno` (actualización por lote)
    - [x] `GET /completa_docente/:id_docente`
    - [x] `GET /grupo_docentes/:id_grupo` (consulta consolidada de todos los docentes de un grupo)
  - [x] `/api/horario_grupo` — Asignación en grilla horaria con validación de conflictos en BD:
    - [x] `GET /por_grupo/:id_grupo`
    - [x] `POST /` (validación de choques internos, externos, carga horaria y límite de duplas)
    - [x] `DELETE /:id`
  - [x] `/api/vistas` — Endpoints para consumo directo de vistas SQL

---

## 🔐 FASE 4 — Autenticación y Shell de la Aplicación

- [x] Pantalla de inicio de sesión (`index.html`) con diseño glassmorphism
- [x] Validación de credenciales de acceso administrativo (`Admin` / `905011_Yo`)
- [x] Control de sesión en cliente (`sessionStorage`) y redirección de seguridad en `js/app.js`
- [x] Shell principal (`dashboard.html`):
  - [x] Barra lateral con navegación por módulos y estado activo
  - [x] Barra superior con indicador en vivo de conexión con el servidor backend (`status-dot`)
  - [x] Perfil de usuario y botón de cierre de sesión
  - [x] Área dinámica de carga de módulos tipo SPA

---

## 🎨 FASE 5 — Frontend, Sistema de Diseño y UI Reutilizable

- [x] Arquitectura de estilos CSS con variables globales y tema oscuro moderno (`css/estilos.css`):
  - [x] Paleta temática (fondo, glassmorphism, bordes translúcidos, acentos indigo/violeta)
  - [x] Tipografía Inter desde Google Fonts
  - [x] Integración de Font Awesome 6
- [x] Estilos especializados por componente:
  - [x] `css/dashboard.css` (layout responsive de sidebar y main content)
  - [x] `css/formularios.css` (campos flotantes, selects estilizados, botones, estados de foco)
  - [x] `css/horario.css` (grillas semanales, celdas de horarios, tarjetas de docentes, etiquetas y barras de progreso)
- [x] Paleta de estados estandarizada:
  - [x] 🟢 Verde — Disponible / Libre para asignar
  - [x] 🔴 Rojo — Ocupado en otra institución (externo)
  - [x] 🔵 Azul / Violeta — Clase asignada en el liceo (interno)
  - [x] 🟡 Amarillo — Alerta de conflicto / Advertencia de dupla
  - [x] ⚫ Gris / Translúcido — Celda vacía sin asignar
- [x] Biblioteca de componentes reutilizables en `js/ui.js`:
  - [x] Modales interactivos (`UI.modalFormulario`, `UI.confirmar`)
  - [x] Sistema de notificaciones Toast no intrusivas (`UI.mostrarToast`)
  - [x] Estados de carga (`UI.mostrarCargando`) y estados vacíos (`UI.renderizarVacio`)
  - [x] Encabezados estándar de módulos (`UI.headerModulo`)

---

## 📋 FASE 6 — Módulos CRUD de Configuración y Gestión

### 6.1 Niveles Educativos (`modulos/niveles.js`)
- [x] Listado de niveles educativos con conteo de grupos asociados
- [x] Crear nuevo nivel
- [x] Editar nombre de nivel existente
- [x] Eliminar nivel (con protección y advertencia si contiene grupos)

### 6.2 Turnos y Horarios (`modulos/horarios.js`)
- [x] Listado de turnos con resumen de franjas horarias
- [x] Crear, editar y eliminar turnos
- [x] Configuración detallada de horas por turno (número de hora, hora de inicio y fin)
- [x] Edición y eliminación individual de horas de cada turno

### 6.3 Grupos (`modulos/grupos.js`)
- [x] Listado tabular de grupos con visualización de nivel y turno asignado
- [x] Crear grupo (asociando nivel, turno y número/letra)
- [x] Editar y eliminar grupo con control de dependencias

### 6.4 Asignaturas (`modulos/asignaturas.js`)
- [x] Listado de asignaturas con filtro rápido por nivel educativo
- [x] Crear asignatura especificando nivel y carga horaria semanal en horas pedagógicas
- [x] Editar y eliminar asignaturas

### 6.5 Docentes y Asignación de Materias (`modulos/docentes.js`)
- [x] Listado de docentes con buscador y resumen de materias habilitadas
- [x] Alta, modificación y baja de datos personales del docente (nombre, apellido, cédula)
- [x] Panel de inscripción de asignaturas por docente con escalafón:
  - [x] Grado docente (1° a 7°)
  - [x] Puntaje de escalafón
  - [x] Condición (Efectivo / Interino / Suplente)
- [x] Visualización y eliminación de asignaturas inscritas por docente

### 6.6 Disponibilidad Docente (`modulos/disponibilidad.js`)
- [x] Selector unificado de docente con buscador
- [x] Grillas semanales independientes por turno (Lunes a Viernes × horas del turno)
- [x] Conmutación interactiva de celdas libres vs. ocupadas en otras instituciones
- [x] Reflejo en tiempo real de clases ya asignadas dentro del liceo (bloques no editables con nombre de grupo y materia)
- [x] Guardado independiente por turno con feedback visual de guardado
- [x] Exportación directa del horario del docente a Excel (`.xlsx`) e Impresión / PDF

---

## 📅 FASE 7 — Armado de Horarios y Asignación Docente

### 7.1 Asignación de Docentes a Grupos (`modulos/asignacion_grupo.js`)
*Módulo preparatorio previo al armado del horario*
- [x] Selector de grupo con filtrado por nivel educativo y pestañas rápidas (*pills*)
- [x] Visualización de la malla curricular del grupo con tarjetas por materia
- [x] Desplegables de docentes filtrados por especialidad y ordenados automáticamente por escalafón oficial (Efectivo > Grado > Puntaje)
- [x] Soporte nativo para 2° docente / Duplas pedagógicas (ej. Taller, laboratorio o co-enseñanza)
- [x] Indicadores en tiempo real de materias asignadas vs. pendientes
- [x] Botón de navegación directa hacia el módulo de armado de horarios

### 7.2 Interfaz de Armado de Horarios (`modulos/armado.js`)
- [x] Pantalla de selección de grupos clasificada por niveles con badges de estado (completo/incompleto)
- [x] Pantalla intermedia integrada para gestionar docentes asignados al grupo
- [x] Panel superior con metadatos del grupo (nivel, turno, horas asignadas vs. totales)
- [x] Panel central con grilla semanal interactiva (días lun–vie × horas del turno)
- [x] Panel lateral de docentes con orden de mérito, horas asignadas y barras de progreso visuales
- [x] Botón de acceso directo a la consulta multidocente de disponibilidad

### 7.3 Funcionalidad de Asignación en Grilla y Reglas de Negocio
- [x] Asignación de clases por selección de docente + clic en celda de la grilla
- [x] Soporte para duplas en la misma celda horaria (hasta 2 asignaturas/docentes por bloque)
- [x] Eliminación de asignaciones individuales desde la propia celda
- [x] Persistencia automática y sincronización inmediata con PostgreSQL
- [x] Detección y validación de conflictos en tiempo real:
  - [x] Validación de superposición horaria del docente en otro grupo del liceo
  - [x] Validación de conflicto con disponibilidad externa (otra institución)
  - [x] Control de tope de carga horaria semanal por asignatura
  - [x] Límite máximo de 2 asignaturas por bloque (dupla)
  - [x] Límite máximo de 2 duplas por grupo
  - [x] Mensajes de error y avisos descriptivos al usuario

### 7.4 Consulta Multidocente de Disponibilidad (`consulta_disponibilidad.html` + `js/consulta_disponibilidad.js`)
- [x] Ventana/pestaña emergente de consulta en tiempo real para el grupo seleccionado
- [x] Modo Pestañas: lista lateral de docentes con ficha y grilla semanal individual
- [x] Modo Mosaico: visualización simultánea de todos los profesores del grupo en cuadrícula
- [x] Buscador dinámico por nombre de docente o materia
- [x] Botón de actualización en vivo de datos
- [x] Código de colores para diferenciar disponibilidad libre, ocupación externa y clases en otros grupos

---

## 📤 FASE 8 — Exportación e Informes

- [x] Integración de SheetJS (`xlsx.full.min.js`) en cliente
- [x] Exportación de horario de grupo a Excel (`.xlsx`) con estructura de planilla limpia, anchos de columna adaptados y soporte para duplas
- [x] Exportación de horario individual de docente a Excel (`.xlsx`) consolidando todos sus turnos y ocupaciones
- [x] Plantilla de impresión / guardado en PDF de horario de grupo:
  - [x] Formato A4 horizontal optimizado
  - [x] Cabecera institucional con datos del grupo y fecha de emisión
  - [x] Resaltado de duplas y asignaturas
  - [x] Espacio al pie con líneas de firma para Dirección y Bedelía/Adscripción
- [x] Plantilla de impresión / PDF de horario y disponibilidad semanal del docente
- [ ] *(Futuro opcional)* Exportación del consolidado institucional completo (todos los grupos en un solo libro Excel)

---

## 🧪 FASE 9 — Pruebas, Verificación y Despliegue

- [ ] Prueba del flujo integral de trabajo:
  - [ ] Login → Configuración básica (Nivel, Turno, Grupo, Materia)
  - [ ] Alta de docentes y registro de escalafón / asignaturas
  - [ ] Carga de disponibilidad externa por docente
  - [ ] Asignación de docentes a grupos (incluyendo materias en dupla)
  - [ ] Armado interactivo del horario semanal y resolución de conflictos
  - [ ] Exportación a `.xlsx` e impresión en PDF
- [ ] Verificación de rendimiento de consultas con volumen real de docentes y grupos
- [ ] Revisión de contraste y legibilidad visual en pantallas de proyección o monitores de baja resolución
- [ ] Guía de usuario e instrucciones de puesta en marcha local documentadas

---

**Progreso del Proyecto:**
- **Fases 1 a 8:** ✅ Completadas al 100%
- **Fase 9:** 🟡 En proceso de verificación y pruebas finales
