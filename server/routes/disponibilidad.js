// ============================================================
// routes/disponibilidad.js
// Horarios ocupados del docente en otras instituciones por turno
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Auto-migración defensiva para asegurar columna id_turno ──
(async () => {
  try {
    await db.query(`
      ALTER TABLE disponibilidad_docente 
      ADD COLUMN IF NOT EXISTS id_turno INTEGER REFERENCES turnos(id) ON DELETE CASCADE;
    `);

    // Asignar primer turno si quedaron registros sin turno asignado
    await db.query(`
      UPDATE disponibilidad_docente 
      SET id_turno = (SELECT id FROM turnos ORDER BY id LIMIT 1) 
      WHERE id_turno IS NULL;
    `);

    // Ajustar constraint UNIQUE para incluir id_turno
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'disponibilidad_docente_id_docente_dia_semana_numero_hora_key'
        ) THEN
          ALTER TABLE disponibilidad_docente 
          DROP CONSTRAINT disponibilidad_docente_id_docente_dia_semana_numero_hora_key;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'disponibilidad_docente_docente_turno_dia_hora_key'
        ) THEN
          ALTER TABLE disponibilidad_docente 
          ADD CONSTRAINT disponibilidad_docente_docente_turno_dia_hora_key 
          UNIQUE (id_docente, id_turno, dia_semana, numero_hora);
        END IF;
      END $$;
    `);
  } catch (err) {
    console.warn('Verificación de esquema en disponibilidad_docente:', err.message);
  }
})();

// GET /api/disponibilidad — Todos los registros
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT dd.*, d.nombre AS docente_nombre, d.apellido AS docente_apellido, t.nombre AS turno_nombre
      FROM disponibilidad_docente dd
      JOIN docentes d ON d.id = dd.id_docente
      LEFT JOIN turnos t ON t.id = dd.id_turno
      ORDER BY dd.id_docente, dd.id_turno, dd.dia_semana, dd.numero_hora
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// GET /api/disponibilidad/por_docente/:id_docente — Disponibilidad de un docente para todos sus turnos
router.get('/por_docente/:id_docente', async (req, res) => {
  try {
    const { id_docente } = req.params;
    const resultado = await db.query(`
      SELECT dd.*, t.nombre AS turno_nombre
      FROM disponibilidad_docente dd
      LEFT JOIN turnos t ON t.id = dd.id_turno
      WHERE dd.id_docente = $1
      ORDER BY dd.id_turno, dd.dia_semana, dd.numero_hora
    `, [id_docente]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad del docente' });
  }
});

// GET /api/disponibilidad/por_docente_turno/:id_docente/:id_turno — Disponibilidad de un docente para un turno
router.get('/por_docente_turno/:id_docente/:id_turno', async (req, res) => {
  try {
    const { id_docente, id_turno } = req.params;
    const resultado = await db.query(`
      SELECT * FROM disponibilidad_docente
      WHERE id_docente = $1 AND id_turno = $2
      ORDER BY dia_semana, numero_hora
    `, [id_docente, id_turno]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad del docente en el turno' });
  }
});

// GET /api/disponibilidad/completa_docente/:id_docente — Disponibilidad externa + Clases asignadas en el Liceo
router.get('/completa_docente/:id_docente', async (req, res) => {
  try {
    const { id_docente } = req.params;

    // 1. Ocupación externa (otras instituciones)
    const externos = await db.query(`
      SELECT dd.id, dd.id_docente, dd.id_turno, dd.dia_semana, dd.numero_hora, dd.ocupado,
             'externo' AS tipo_ocupacion
      FROM disponibilidad_docente dd
      WHERE dd.id_docente = $1 AND dd.ocupado = TRUE
      ORDER BY dd.id_turno, dd.dia_semana, dd.numero_hora
    `, [id_docente]);

    // 2. Ocupación interna (clases asignadas en el liceo en horario_grupo)
    const internos = await db.query(`
      SELECT hg.id AS id_horario, da.id_docente, g.id_turno, hg.dia_semana, hg.numero_hora,
             'interno' AS tipo_ocupacion,
             hg.id_grupo,
             CONCAT(n.nombre, g.numero) AS grupo_nombre,
             a.nombre AS asignatura_nombre
      FROM horario_grupo hg
      JOIN grupos              g  ON g.id  = hg.id_grupo
      JOIN niveles             n  ON n.id  = g.id_nivel
      JOIN asignacion_docente  ad ON ad.id = hg.id_grupo_docente
      JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
      JOIN asignaturas         a  ON a.id  = ad.id_asignatura
      WHERE da.id_docente = $1
      ORDER BY g.id_turno, hg.dia_semana, hg.numero_hora
    `, [id_docente]);

    res.json({
      externos: externos.rows,
      internos: internos.rows
    });
  } catch (error) {
    console.error('Error al obtener disponibilidad completa del docente:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad completa del docente' });
  }
});

// PUT /api/disponibilidad/guardar_turno — Guardado atómico/batch de disponibilidad por docente y turno
// Body: { id_docente, id_turno, cambios: [ { dia_semana, numero_hora, ocupado } ] }
router.put('/guardar_turno', async (req, res) => {
  const cliente = await db.connect();
  try {
    const { id_docente, id_turno, cambios } = req.body;
    if (!id_docente || !id_turno || !Array.isArray(cambios)) {
      return res.status(400).json({ error: 'id_docente, id_turno y lista de cambios son obligatorios' });
    }

    await cliente.query('BEGIN');

    for (const c of cambios) {
      const { dia_semana, numero_hora, ocupado } = c;
      await cliente.query(`
        INSERT INTO disponibilidad_docente (id_docente, id_turno, dia_semana, numero_hora, ocupado)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_docente, id_turno, dia_semana, numero_hora)
        DO UPDATE SET ocupado = EXCLUDED.ocupado
      `, [id_docente, id_turno, dia_semana, numero_hora, !!ocupado]);
    }

    await cliente.query('COMMIT');
    res.json({ ok: true, mensaje: `Disponibilidad actualizada (${cambios.length} cambios aplicados)` });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al guardar disponibilidad por turno:', error);
    res.status(500).json({ error: 'Error al guardar la disponibilidad en la base de datos' });
  } finally {
    cliente.release();
  }
});

// PUT /api/disponibilidad/upsert — Crear o actualizar una celda individual
// Body: { id_docente, id_turno, dia_semana, numero_hora, ocupado }
router.put('/upsert', async (req, res) => {
  try {
    const { id_docente, id_turno, dia_semana, numero_hora, ocupado } = req.body;
    if (!id_docente || !dia_semana || !numero_hora || ocupado === undefined) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const turnoFinal = id_turno || (await db.query('SELECT id FROM turnos ORDER BY id LIMIT 1')).rows[0]?.id;

    const resultado = await db.query(`
      INSERT INTO disponibilidad_docente (id_docente, id_turno, dia_semana, numero_hora, ocupado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id_docente, id_turno, dia_semana, numero_hora)
      DO UPDATE SET ocupado = EXCLUDED.ocupado
      RETURNING *
    `, [id_docente, turnoFinal, dia_semana, numero_hora, ocupado]);
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar disponibilidad' });
  }
});

// GET /api/disponibilidad/:id — Un registro por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM disponibilidad_docente WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});

// POST /api/disponibilidad — Marcar un bloque como ocupado
router.post('/', async (req, res) => {
  try {
    const { id_docente, id_turno, dia_semana, numero_hora, ocupado } = req.body;
    if (!id_docente || !dia_semana || !numero_hora) {
      return res.status(400).json({ error: 'id_docente, dia_semana y numero_hora son obligatorios' });
    }
    if (dia_semana < 1 || dia_semana > 5) {
      return res.status(400).json({ error: 'dia_semana debe estar entre 1 (lunes) y 5 (viernes)' });
    }
    if (numero_hora <= 0) {
      return res.status(400).json({ error: 'numero_hora debe ser mayor a 0' });
    }

    const turnoFinal = id_turno || (await db.query('SELECT id FROM turnos ORDER BY id LIMIT 1')).rows[0]?.id;
    const estaOcupado = ocupado !== undefined ? ocupado : true;

    const resultado = await db.query(`
      INSERT INTO disponibilidad_docente (id_docente, id_turno, dia_semana, numero_hora, ocupado)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [id_docente, turnoFinal, dia_semana, numero_hora, estaOcupado]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un registro para ese docente, turno, día y hora' });
    }
    res.status(500).json({ error: 'Error al registrar disponibilidad' });
  }
});

// PUT /api/disponibilidad/:id — Actualizar estado de un bloque por ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ocupado } = req.body;
    if (ocupado === undefined) {
      return res.status(400).json({ error: 'ocupado es obligatorio (true o false)' });
    }
    const resultado = await db.query(`
      UPDATE disponibilidad_docente SET ocupado = $1 WHERE id = $2 RETURNING *
    `, [ocupado, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar disponibilidad' });
  }
});

// DELETE /api/disponibilidad/:id — Eliminar un registro
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM disponibilidad_docente WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la disponibilidad' });
  }
});

module.exports = router;
