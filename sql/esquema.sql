-- ============================================================
-- esquema.sql
-- Sistema de Armado de Horarios — PostgreSQL 16
-- Definición completa de tablas, restricciones e índices
-- ============================================================

-- ------------------------------------------------------------
-- Limpieza (orden inverso para respetar claves foráneas)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS horario_grupo          CASCADE;
DROP TABLE IF EXISTS disponibilidad_docente CASCADE;
DROP TABLE IF EXISTS asignacion_docente     CASCADE;
DROP TABLE IF EXISTS grupo_asignatura       CASCADE;
DROP TABLE IF EXISTS docente_asignatura     CASCADE;
DROP TABLE IF EXISTS docentes               CASCADE;
DROP TABLE IF EXISTS asignaturas            CASCADE;
DROP TABLE IF EXISTS grupos                 CASCADE;
DROP TABLE IF EXISTS horarios_turno         CASCADE;
DROP TABLE IF EXISTS turnos                 CASCADE;
DROP TABLE IF EXISTS niveles                CASCADE;

-- ============================================================
-- Tabla: niveles
-- Representa los niveles educativos de la institución
-- Ejemplos: 7°, 8°, 9°, 1° EMS, 2° EMS, 3° EMS
-- ============================================================
CREATE TABLE niveles (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================================
-- Tabla: turnos
-- Representa los turnos de funcionamiento de la institución
-- Ejemplos: Matutino, Vespertino, Nocturno
-- ============================================================
CREATE TABLE turnos (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================================
-- Tabla: horarios_turno
-- Almacena las horas de clase correspondientes a cada turno
-- Cada turno puede tener distintas horas de inicio y fin
-- ============================================================
CREATE TABLE horarios_turno (
    id          SERIAL PRIMARY KEY,
    id_turno    INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    numero_hora INTEGER NOT NULL CHECK (numero_hora > 0),
    hora_inicio TIME    NOT NULL,
    hora_fin    TIME    NOT NULL,
    UNIQUE (id_turno, numero_hora)
);

-- ============================================================
-- Tabla: grupos
-- Representa cada grupo existente en la institución
-- Un grupo pertenece a un único nivel y un único turno
-- Ejemplo: nivel=7°, turno=Matutino, numero=1 → "7°1"
-- ============================================================
CREATE TABLE grupos (
    id       SERIAL PRIMARY KEY,
    id_nivel INTEGER NOT NULL REFERENCES niveles(id) ON DELETE RESTRICT,
    id_turno INTEGER NOT NULL REFERENCES turnos(id)  ON DELETE RESTRICT,
    numero   INTEGER NOT NULL CHECK (numero > 0),
    UNIQUE (id_nivel, id_turno, numero)
);

-- ============================================================
-- Tabla: asignaturas
-- Asignaturas por nivel con su carga horaria semanal
-- Una misma asignatura en distintos niveles = registros distintos
-- Ejemplo: "Informática" en 7° (3h) y en 8° (2h) son dos registros
-- ============================================================
CREATE TABLE asignaturas (
    id            SERIAL PRIMARY KEY,
    id_nivel      INTEGER      NOT NULL REFERENCES niveles(id) ON DELETE RESTRICT,
    nombre        VARCHAR(100) NOT NULL,
    carga_horaria INTEGER      NOT NULL CHECK (carga_horaria > 0),
    UNIQUE (id_nivel, nombre)
);

-- ============================================================
-- Tabla: docentes
-- Información personal de cada docente
-- ============================================================
CREATE TABLE docentes (
    id       SERIAL PRIMARY KEY,
    nombre   VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula   VARCHAR(20)  NOT NULL UNIQUE
);

-- ============================================================
-- Tabla: docente_asignatura
-- Relaciona docentes con las asignaturas que pueden dictar
-- Un docente puede impartir varias asignaturas
-- Cada asignatura puede tener varios docentes
-- grado: del 1 al 7 (eficacia del docente en esa asignatura)
-- puntaje: puntaje acumulado del docente (ej. 114.20)
-- ============================================================
CREATE TABLE docente_asignatura (
    id            SERIAL PRIMARY KEY,
    id_docente    INTEGER        NOT NULL REFERENCES docentes(id)    ON DELETE CASCADE,
    id_asignatura INTEGER        NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    grado         INTEGER        NOT NULL CHECK (grado BETWEEN 1 AND 7),
    puntaje       NUMERIC(10, 2) NOT NULL CHECK (puntaje >= 0),
    UNIQUE (id_docente, id_asignatura)
);

-- ============================================================
-- Tabla: grupo_asignatura
-- Indica qué asignaturas posee cada grupo
-- Es el puente entre un grupo y sus asignaturas del nivel
-- ============================================================
CREATE TABLE grupo_asignatura (
    id            SERIAL PRIMARY KEY,
    id_grupo      INTEGER NOT NULL REFERENCES grupos(id)     ON DELETE CASCADE,
    id_asignatura INTEGER NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    UNIQUE (id_grupo, id_asignatura)
);

-- ============================================================
-- Tabla: asignacion_docente
-- Asigna el docente que dictará una asignatura en un grupo
-- Cada grupo tiene un único docente por asignatura
-- id_docente_asignatura referencia qué docente+asignatura
-- ============================================================
CREATE TABLE asignacion_docente (
    id                    SERIAL PRIMARY KEY,
    id_grupo              INTEGER NOT NULL REFERENCES grupos(id)             ON DELETE CASCADE,
    id_asignatura         INTEGER NOT NULL REFERENCES asignaturas(id)        ON DELETE CASCADE,
    id_docente_asignatura INTEGER NOT NULL REFERENCES docente_asignatura(id) ON DELETE RESTRICT,
    UNIQUE (id_grupo, id_asignatura)
);

-- ============================================================
-- Tabla: disponibilidad_docente
-- Representa los horarios en que el docente está ocupado
-- en otras instituciones (fuera del liceo)
-- dia_semana: 1=Lunes ... 5=Viernes
-- ocupado=TRUE significa que ese bloque NO está disponible
-- ============================================================
CREATE TABLE disponibilidad_docente (
    id          SERIAL PRIMARY KEY,
    id_docente  INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
    dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    numero_hora INTEGER NOT NULL CHECK (numero_hora > 0),
    ocupado     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (id_docente, dia_semana, numero_hora)
);

-- ============================================================
-- Tabla: horario_grupo
-- Tabla principal del sistema
-- Almacena el horario definitivo de cada grupo
-- Cada registro = una asignatura en una celda del horario
-- Si hay dupla: dos registros para la misma hora (orden_dupla 1 y 2)
-- id_grupo_docente referencia asignacion_docente (quién dicta qué)
-- ============================================================
CREATE TABLE horario_grupo (
    id               SERIAL PRIMARY KEY,
    id_grupo         INTEGER NOT NULL REFERENCES grupos(id)             ON DELETE CASCADE,
    dia_semana       INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    numero_hora      INTEGER NOT NULL CHECK (numero_hora > 0),
    id_grupo_docente INTEGER NOT NULL REFERENCES asignacion_docente(id) ON DELETE CASCADE,
    orden_dupla      INTEGER NOT NULL DEFAULT 1 CHECK (orden_dupla IN (1, 2)),
    UNIQUE (id_grupo, dia_semana, numero_hora, orden_dupla)
);

-- ============================================================
-- Índices recomendados
-- Aceleran las validaciones durante el armado de horarios
-- ============================================================

-- horario_grupo: tabla de alta lectura durante el armado
CREATE INDEX idx_hg_grupo           ON horario_grupo(id_grupo);
CREATE INDEX idx_hg_dia_hora        ON horario_grupo(dia_semana, numero_hora);
CREATE INDEX idx_hg_grupo_docente   ON horario_grupo(id_grupo_docente);

-- disponibilidad_docente: consultada para detectar conflictos externos
CREATE INDEX idx_disp_docente       ON disponibilidad_docente(id_docente);
CREATE INDEX idx_disp_dia_hora      ON disponibilidad_docente(dia_semana, numero_hora);

-- docente_asignatura: consultada para listar y ordenar docentes
CREATE INDEX idx_da_docente         ON docente_asignatura(id_docente);
CREATE INDEX idx_da_asignatura      ON docente_asignatura(id_asignatura);

-- grupo_asignatura: consultada al cargar el panel de armado
CREATE INDEX idx_ga_grupo           ON grupo_asignatura(id_grupo);
CREATE INDEX idx_ga_asignatura      ON grupo_asignatura(id_asignatura);

-- asignacion_docente: consultada frecuentemente en el armado
CREATE INDEX idx_ad_grupo           ON asignacion_docente(id_grupo);
CREATE INDEX idx_ad_asignatura      ON asignacion_docente(id_asignatura);

-- grupos: filtros por nivel y turno
CREATE INDEX idx_grupos_nivel       ON grupos(id_nivel);
CREATE INDEX idx_grupos_turno       ON grupos(id_turno);

-- asignaturas: filtro por nivel
CREATE INDEX idx_asignaturas_nivel  ON asignaturas(id_nivel);
