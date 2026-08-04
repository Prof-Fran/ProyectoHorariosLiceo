// ============================================================
// routes/asignaturas.js — CRUD de asignaturas por nivel
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/asignaturas — Todas las asignaturas (con nivel)
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT a.*, n.nombre AS nivel_nombre
      FROM asignaturas a
      JOIN niveles n ON n.id = a.id_nivel
      ORDER BY n.nombre, a.nombre
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaturas' });
  }
});

// GET /api/asignaturas/por_nivel/:id_nivel — Asignaturas de un nivel
router.get('/por_nivel/:id_nivel', async (req, res) => {
  try {
    const { id_nivel } = req.params;
    const resultado = await db.query(`
      SELECT a.*, n.nombre AS nivel_nombre
      FROM asignaturas a
      JOIN niveles n ON n.id = a.id_nivel
      WHERE a.id_nivel = $1
      ORDER BY a.nombre
    `, [id_nivel]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaturas del nivel' });
  }
});

// GET /api/asignaturas/:id — Una asignatura por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query(`
      SELECT a.*, n.nombre AS nivel_nombre
      FROM asignaturas a
      JOIN niveles n ON n.id = a.id_nivel
      WHERE a.id = $1
    `, [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la asignatura' });
  }
});

// POST /api/asignaturas — Crear una asignatura
router.post('/', async (req, res) => {
  try {
    const { id_nivel, nombre, carga_horaria } = req.body;
    if (!id_nivel || !nombre || !carga_horaria) {
      return res.status(400).json({ error: 'id_nivel, nombre y carga_horaria son obligatorios' });
    }
    if (carga_horaria <= 0) {
      return res.status(400).json({ error: 'La carga horaria debe ser mayor a 0' });
    }
    const resultado = await db.query(`
      INSERT INTO asignaturas (id_nivel, nombre, carga_horaria)
      VALUES ($1, $2, $3) RETURNING *
    `, [id_nivel, nombre, carga_horaria]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe la asignatura "${req.body.nombre}" en ese nivel` });
    }
    res.status(500).json({ error: 'Error al crear la asignatura' });
  }
});

// PUT /api/asignaturas/:id — Actualizar una asignatura
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_nivel, nombre, carga_horaria } = req.body;
    if (!id_nivel || !nombre || !carga_horaria) {
      return res.status(400).json({ error: 'id_nivel, nombre y carga_horaria son obligatorios' });
    }
    if (carga_horaria <= 0) {
      return res.status(400).json({ error: 'La carga horaria debe ser mayor a 0' });
    }
    const resultado = await db.query(`
      UPDATE asignaturas SET id_nivel = $1, nombre = $2, carga_horaria = $3
      WHERE id = $4 RETURNING *
    `, [id_nivel, nombre, carga_horaria, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe la asignatura "${req.body.nombre}" en ese nivel` });
    }
    res.status(500).json({ error: 'Error al actualizar la asignatura' });
  }
});

// DELETE /api/asignaturas/:id — Eliminar una asignatura
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM asignaturas WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json({ mensaje: 'Asignatura eliminada correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene docentes o grupos asociados' });
    }
    res.status(500).json({ error: 'Error al eliminar la asignatura' });
  }
});

module.exports = router;
