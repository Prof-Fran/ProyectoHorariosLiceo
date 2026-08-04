// ============================================================
// routes/horarios_turno.js — CRUD de horarios por turno
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/horarios_turno — Obtener todos (con nombre del turno)
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT ht.*, t.nombre AS turno_nombre
      FROM horarios_turno ht
      JOIN turnos t ON t.id = ht.id_turno
      ORDER BY ht.id_turno, ht.numero_hora
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener horarios de turno' });
  }
});

// GET /api/horarios_turno/por_turno/:id_turno — Horas de un turno específico
router.get('/por_turno/:id_turno', async (req, res) => {
  try {
    const { id_turno } = req.params;
    const resultado = await db.query(`
      SELECT ht.*, t.nombre AS turno_nombre
      FROM horarios_turno ht
      JOIN turnos t ON t.id = ht.id_turno
      WHERE ht.id_turno = $1
      ORDER BY ht.numero_hora
    `, [id_turno]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener horarios del turno' });
  }
});

// GET /api/horarios_turno/:id — Obtener una hora por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM horarios_turno WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el horario' });
  }
});

// POST /api/horarios_turno — Crear una hora de turno
router.post('/', async (req, res) => {
  try {
    const { id_turno, numero_hora, hora_inicio, hora_fin } = req.body;
    if (!id_turno || !numero_hora || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (numero_hora <= 0) {
      return res.status(400).json({ error: 'El número de hora debe ser mayor a 0' });
    }
    const resultado = await db.query(`
      INSERT INTO horarios_turno (id_turno, numero_hora, hora_inicio, hora_fin)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id_turno, numero_hora, hora_inicio, hora_fin]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe esa hora para este turno' });
    }
    res.status(500).json({ error: 'Error al crear el horario de turno' });
  }
});

// PUT /api/horarios_turno/:id — Actualizar una hora de turno
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hora_inicio, hora_fin } = req.body;
    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'hora_inicio y hora_fin son obligatorios' });
    }
    const resultado = await db.query(`
      UPDATE horarios_turno SET hora_inicio = $1, hora_fin = $2
      WHERE id = $3 RETURNING *
    `, [hora_inicio, hora_fin, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el horario' });
  }
});

// DELETE /api/horarios_turno/:id — Eliminar una hora de turno
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM horarios_turno WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }
    res.json({ mensaje: 'Horario de turno eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el horario' });
  }
});

module.exports = router;
