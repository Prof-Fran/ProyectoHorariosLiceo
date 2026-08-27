# ✅ Tareas Pendientes — Sistema de Armado de Horarios

> **Leyenda de estados:**
> - `[ ]` — No iniciada
> - `[/]` — En proceso
> - `[x]` — Completada

---

## 🏗️ FASE 1 — Setup del Proyecto

- [x] Decidir estrategia de conexión a PostgreSQL (Node.js local / Electron / PGLite)
- [x] Crear estructura de carpetas del proyecto (`css/`, `js/`, `modulos/`, `sql/`, `server/`, `docs/`)
- [x] Configurar `package.json` si se usa Node.js para el servidor local
- [x] Instalar dependencias: `express`, `pg`, `cors` (si aplica Node.js)
- [x] Verificar que PostgreSQL esté instalado y corriendo localmente

---

## 🗄️ FASE 2 — Base de Datos

- [x] Crear el esquema SQL completo (`sql/esquema.sql`)
  - [x] Tabla `niveles`
  - [x] Tabla `turnos`
  - [x] Tabla `horarios_turno`
  - [x] Tabla `grupos`
  - [x] Tabla `asignaturas`
  - [x] Tabla `docentes`
  - [x] Tabla `docente_asignatura`
  - [x] Tabla `grupo_asignatura`
  - [x] Tabla `asignacion_docente`
  - [x] Tabla `disponibilidad_docente`
  - [x] Tabla `horario_grupo`
- [x] Definir claves foráneas y restricciones (`NOT NULL`, `UNIQUE`, `CHECK`)
- [x] Crear índices recomendados sobre las columnas de búsqueda frecuente
- [x] Crear vistas útiles (`sql/vistas.sql`)
  - [x] Vista: docentes ordenados por grado + puntaje por asignatura
  - [x] Vista: horas asignadas vs. restantes por docente/grupo
- [x] Crear datos iniciales opcionales (`sql/datos_iniciales.sql`)
  - [x] Niveles de ejemplo (7°, 8°, 9°, 1° EMS, 2° EMS, 3° EMS)
  - [x] Turnos de ejemplo (Matutino, Vespertino, Nocturno)
- [x] Ejecutar y verificar el esquema en PostgreSQL local

---

## 🔌 FASE 3 — Backend / API Local (server.js)

- [x] Crear servidor Node.js mínimo en `server/server.js`
- [x] Configurar conexión a PostgreSQL con `pg`
- [x] Implementar endpoints REST para cada módulo:
  - [x] `/api/niveles` — GET, POST, PUT, DELETE
  - [x] `/api/turnos` — GET, POST, PUT, DELETE
  - [x] `/api/horarios_turno` — GET, POST, PUT, DELETE
  - [x] `/api/grupos` — GET, POST, PUT, DELETE
  - [x] `/api/asignaturas` — GET, POST, PUT, DELETE
  - [x] `/api/docentes` — GET, POST, PUT, DELETE
  - [x] `/api/docente_asignatura` — GET, POST, PUT, DELETE
  - [x] `/api/grupo_asignatura` — GET, POST, PUT, DELETE
  - [x] `/api/asignacion_docente` — GET, POST, PUT, DELETE
  - [x] `/api/disponibilidad` — GET, POST, PUT, DELETE
  - [x] `/api/horario_grupo` — GET, POST, PUT, DELETE
- [x] Implementar validaciones a nivel de base de datos en los endpoints
- [x] Configurar CORS para que el HTML pueda consumir la API

---

## 🔐 FASE 4 — Autenticación

- [x] Crear pantalla de login (`index.html`)
- [x] Validar credenciales fijas: `Admin` / `905011_Yo`
- [x] Redirigir al dashboard tras login exitoso
- [x] Proteger navegación si no está autenticado (verificación en `app.js`)
- [x] Implementar botón de logout

---

## 🎨 FASE 5 — Frontend / Diseño Visual

- [x] Crear `css/estilos.css` con el sistema de diseño base
  - [x] Variables CSS (colores, tipografía, espaciado)
  - [x] Tema oscuro como base
  - [x] Glassmorphism (fondo difuminado, bordes sutiles)
  - [x] Sombras suaves
  - [x] Tipografía (Inter o similar desde Google Fonts)
- [x] Crear `css/dashboard.css`
- [x] Crear `css/formularios.css`
- [x] Crear `css/horario.css`
- [x] Definir paleta de colores de estados:
  - [x] 🟢 Verde — Disponible
  - [x] 🔴 Rojo — Ocupado en otra institución
  - [x] 🔵 Azul — Ocupado en el liceo
  - [x] ⚫ Gris — Celda vacía
  - [x] 🟡 Amarillo — Advertencia
- [x] Integrar Font Awesome para iconografía
- [x] Crear `js/ui.js` con funciones de renderizado reutilizables

---

## 📋 FASE 6 — Módulos CRUD

### Niveles
- [x] Listar niveles
- [x] Crear nivel
- [x] Editar nivel
- [x] Eliminar nivel (con advertencia si tiene grupos asociados)

### Turnos y Horarios de Turno
- [x] Listar turnos
- [x] Crear / editar / eliminar turno
- [x] Configurar horas por turno (número, hora inicio, hora fin)

### Grupos
- [x] Listar grupos (con nivel y turno)
- [x] Crear grupo (nivel + turno + número)
- [x] Editar / eliminar grupo

### Asignaturas
- [x] Listar asignaturas por nivel
- [x] Crear asignatura (nombre + nivel + carga horaria)
- [x] Editar / eliminar asignatura

### Docentes
- [x] Listar docentes
- [x] Crear docente (nombre, apellido, cédula)
- [x] Editar / eliminar docente
- [x] Asignar asignaturas al docente (con grado 1–7 y puntaje)
- [x] Ver asignaturas asignadas a un docente

### Disponibilidad Docente
- [x] Grilla semanal (lunes–viernes × horas del turno) por docente
- [x] Marcar/desmarcar horas ocupadas en otras instituciones
- [x] Botón de confirmar para guardar los cambios en la base de datos

---

## 📅 FASE 7 — Armado de Horarios (Módulo Principal)

- [ ] Crear pantalla de selección de grupo para armar
- [ ] Implementar panel superior (info del grupo: nivel, turno)
- [ ] Implementar panel izquierdo: grilla semanal del grupo
  - [ ] Columnas: días (lun–vie)
  - [ ] Filas: horas según turno
  - [ ] Celdas con colores según estado
  - [ ] Soporte para duplas (dos asignaturas por celda)
- [ ] Implementar panel derecho: lista de docentes
  - [ ] Ordenados por grado (desc) y puntaje (desc)
  - [ ] Mostrar: asignatura, horas asignadas, horas restantes
- [ ] Implementar asignación por clic en docente + celda de grilla
- [ ] Implementar eliminación de asignación desde la celda
- [ ] Implementar auto-guardado en cada cambio
- [ ] Implementar actualización automática de contadores al cambiar asignación
- [ ] Implementar validaciones en tiempo real:
  - [ ] No superar carga horaria
  - [ ] No superponer docente en mismo horario (distinto grupo)
  - [ ] No asignar docente con conflicto externo
  - [ ] No más de 2 asignaturas por bloque (dupla)
  - [ ] No más de 2 duplas por grupo
- [ ] Mostrar mensajes de error claros (no errores técnicos)

---

## 📤 FASE 8 — Exportación

- [ ] Integrar SheetJS (librería Excel)
- [ ] Exportar horario de un grupo a `.xlsx`
- [ ] Exportar horario de un docente a `.xlsx`
- [ ] (Futuro) Exportar horario completo de la institución
- [ ] (Futuro) Soporte para impresión / PDF

---

## 🧪 FASE 9 — Pruebas y Ajustes Finales

- [ ] Prueba de flujo completo (login → grupos → docentes → armado → export)
- [ ] Verificar que todas las validaciones funcionen correctamente
- [ ] Verificar rendimiento en grilla con muchos registros
- [ ] Revisar legibilidad visual en pantalla proyectada
- [ ] Documentar instrucciones de instalación y uso

---

**Total de tareas principales:** 70+  
**Estado general del proyecto:** 🟡 En progreso — Fases 1–6 completadas

