// ============================================================
// routes/turnos.js — CRUD de turnos
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/turnos — Obtener todos los turnos
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query('SELECT * FROM turnos ORDER BY id');
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
});

// GET /api/turnos/:id — Obtener un turno por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM turnos WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el turno' });
  }
});

// POST /api/turnos — Crear un turno
router.post('/', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const resultado = await db.query(
      'INSERT INTO turnos (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un turno con el nombre "${req.body.nombre}"` });
    }
    res.status(500).json({ error: 'Error al crear el turno' });
  }
});

// PUT /api/turnos/:id — Actualizar un turno
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const resultado = await db.query(
      'UPDATE turnos SET nombre = $1 WHERE id = $2 RETURNING *',
      [nombre, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un turno con el nombre "${req.body.nombre}"` });
    }
    res.status(500).json({ error: 'Error al actualizar el turno' });
  }
});

// DELETE /api/turnos/:id — Eliminar un turno
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM turnos WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json({ mensaje: 'Turno eliminado correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene grupos o horarios asociados' });
    }
    res.status(500).json({ error: 'Error al eliminar el turno' });
  }
});

module.exports = router;
