-- ============================================================
-- vistas.sql
-- Sistema de Armado de Horarios
-- Vistas para consultas frecuentes de la aplicación
-- ============================================================

-- ============================================================
-- Vista: vista_docentes_por_asignatura
-- Lista todos los docentes con sus asignaturas.
-- Orden: primero los efectivos, luego los no efectivos.
-- Dentro de cada grupo (efectivo/no efectivo) se ordenan
-- por grado (desc) y para desempatar por puntaje (desc).
-- Usada en el panel derecho del armado de horarios
-- ============================================================
CREATE OR REPLACE VIEW vista_docentes_por_asignatura AS
SELECT
    da.id                AS id_docente_asignatura,
    d.id                 AS id_docente,
    d.nombre             AS docente_nombre,
    d.apellido           AS docente_apellido,
    d.cedula             AS docente_cedula,
    a.id                 AS id_asignatura,
    a.nombre             AS asignatura_nombre,
    a.carga_horaria      AS carga_horaria,
    a.id_nivel           AS id_nivel,
    n.nombre             AS nivel_nombre,
    da.grado             AS grado,
    da.puntaje           AS puntaje,
    da.efectivo          AS efectivo
FROM docente_asignatura da
JOIN docentes    d ON d.id = da.id_docente
JOIN asignaturas a ON a.id = da.id_asignatura
JOIN niveles     n ON n.id = a.id_nivel
ORDER BY da.efectivo DESC, da.grado DESC, da.puntaje DESC;

-- ============================================================
-- Vista: vista_horas_grupo
-- Muestra las horas asignadas y restantes por grupo y asignatura
-- Incluye el docente asignado si existe
-- Usada para el contador de horas en el panel de armado
-- ============================================================
CREATE OR REPLACE VIEW vista_horas_grupo AS
SELECT
    g.id                                        AS id_grupo,
    n.nombre                                    AS nivel_nombre,
    t.nombre                                    AS turno_nombre,
    g.numero                                    AS grupo_numero,
    a.id                                        AS id_asignatura,
    a.nombre                                    AS asignatura_nombre,
    a.carga_horaria                             AS carga_horaria,
    COUNT(hg.id)                                AS horas_asignadas,
    (a.carga_horaria - COUNT(hg.id))            AS horas_restantes,
    ad.id                                       AS id_asignacion,
    da.id                                       AS id_docente_asignatura,
    d.id                                        AS id_docente,
    d.nombre                                    AS docente_nombre,
    d.apellido                                  AS docente_apellido,
    da.grado                                    AS docente_grado,
    da.puntaje                                  AS docente_puntaje,
    da.efectivo                                 AS docente_efectivo
FROM grupo_asignatura ga
JOIN grupos      g  ON g.id  = ga.id_grupo
JOIN niveles     n  ON n.id  = g.id_nivel
JOIN turnos      t  ON t.id  = g.id_turno
JOIN asignaturas a  ON a.id  = ga.id_asignatura
LEFT JOIN asignacion_docente  ad ON ad.id_grupo = g.id AND ad.id_asignatura = a.id
LEFT JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
LEFT JOIN docentes            d  ON d.id  = da.id_docente
LEFT JOIN horario_grupo       hg ON hg.id_grupo = g.id AND hg.id_grupo_docente = ad.id
GROUP BY
    g.id, n.nombre, t.nombre, g.numero,
    a.id, a.nombre, a.carga_horaria,
    ad.id, da.id, d.id, d.nombre, d.apellido, da.grado, da.puntaje, da.efectivo
ORDER BY n.nombre, g.numero, a.nombre;

-- ============================================================
-- Vista: vista_docente_ocupado
-- Muestra todos los bloques ocupados de cada docente:
-- tanto por otras instituciones (disponibilidad_docente)
-- como por asignaciones dentro del liceo (horario_grupo)
-- Usada para detectar conflictos en tiempo real
-- ============================================================
CREATE OR REPLACE VIEW vista_docente_ocupado AS
-- Bloques ocupados en otras instituciones
SELECT
    d.id            AS id_docente,
    d.nombre        AS docente_nombre,
    d.apellido      AS docente_apellido,
    dd.dia_semana   AS dia_semana,
    dd.numero_hora  AS numero_hora,
    'externo'       AS tipo_ocupacion,
    NULL            AS id_grupo
FROM disponibilidad_docente dd
JOIN docentes d ON d.id = dd.id_docente
WHERE dd.ocupado = TRUE

UNION ALL

-- Bloques ocupados dentro del liceo
SELECT
    d.id            AS id_docente,
    d.nombre        AS docente_nombre,
    d.apellido      AS docente_apellido,
    hg.dia_semana   AS dia_semana,
    hg.numero_hora  AS numero_hora,
    'interno'       AS tipo_ocupacion,
    hg.id_grupo     AS id_grupo
FROM horario_grupo hg
JOIN asignacion_docente  ad ON ad.id = hg.id_grupo_docente
JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
JOIN docentes            d  ON d.id  = da.id_docente
ORDER BY id_docente, dia_semana, numero_hora;
