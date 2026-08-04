// ============================================================
// routes/niveles.js — CRUD de niveles educativos
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/niveles — Obtener todos los niveles
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query('SELECT * FROM niveles ORDER BY id');
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener niveles' });
  }
});

// GET /api/niveles/:id — Obtener un nivel por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM niveles WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Nivel no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el nivel' });
  }
});

// POST /api/niveles — Crear un nivel
router.post('/', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const resultado = await db.query(
      'INSERT INTO niveles (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un nivel con el nombre "${req.body.nombre}"` });
    }
    res.status(500).json({ error: 'Error al crear el nivel' });
  }
});

// PUT /api/niveles/:id — Actualizar un nivel
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const resultado = await db.query(
      'UPDATE niveles SET nombre = $1 WHERE id = $2 RETURNING *',
      [nombre, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Nivel no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un nivel con el nombre "${req.body.nombre}"` });
    }
    res.status(500).json({ error: 'Error al actualizar el nivel' });
  }
});

// DELETE /api/niveles/:id — Eliminar un nivel
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM niveles WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Nivel no encontrado' });
    }
    res.json({ mensaje: 'Nivel eliminado correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene grupos o asignaturas asociadas' });
    }
    res.status(500).json({ error: 'Error al eliminar el nivel' });
  }
});

module.exports = router;
