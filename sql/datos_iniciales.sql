-- ============================================================
-- datos_iniciales.sql
-- Sistema de Armado de Horarios
-- Datos de ejemplo para comenzar a usar la aplicación
-- Ejecutar DESPUÉS de esquema.sql
-- ============================================================

-- ============================================================
-- Niveles educativos
-- ============================================================
INSERT INTO niveles (nombre) VALUES
    ('7°'),
    ('8°'),
    ('9°'),
    ('1° EMS'),
    ('2° EMS'),
    ('3° EMS');

-- ============================================================
-- Turnos de funcionamiento
-- ============================================================
INSERT INTO turnos (nombre) VALUES
    ('Matutino'),
    ('Vespertino'),
    ('Nocturno');

-- ============================================================
-- Horarios por turno
-- Los IDs de turnos dependen del orden de inserción:
--   1 = Matutino, 2 = Vespertino, 3 = Nocturno
-- ============================================================

-- Turno Matutino (6 horas)
INSERT INTO horarios_turno (id_turno, numero_hora, hora_inicio, hora_fin) VALUES
    (1, 1, '07:30', '08:15'),
    (1, 2, '08:15', '09:00'),
    (1, 3, '09:00', '09:45'),
    (1, 4, '10:15', '11:00'),
    (1, 5, '11:00', '11:45'),
    (1, 6, '11:45', '12:30');

-- Turno Vespertino (6 horas)
INSERT INTO horarios_turno (id_turno, numero_hora, hora_inicio, hora_fin) VALUES
    (2, 1, '12:30', '13:15'),
    (2, 2, '13:15', '14:00'),
    (2, 3, '14:00', '14:45'),
    (2, 4, '15:15', '16:00'),
    (2, 5, '16:00', '16:45'),
    (2, 6, '16:45', '17:30');

-- Turno Nocturno (5 horas)
INSERT INTO horarios_turno (id_turno, numero_hora, hora_inicio, hora_fin) VALUES
    (3, 1, '18:00', '18:45'),
    (3, 2, '18:45', '19:30'),
    (3, 3, '19:30', '20:15'),
    (3, 4, '20:30', '21:15'),
    (3, 5, '21:15', '22:00');
