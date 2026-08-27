// ============================================================
// routes/docentes.js — CRUD de docentes
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/docentes — Todos los docentes
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query('SELECT * FROM docentes ORDER BY apellido, nombre');
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener docentes' });
  }
});

// GET /api/docentes/:id — Un docente por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM docentes WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Docente no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el docente' });
  }
});

// GET /api/docentes/:id/asignaturas — Asignaturas del docente
router.get('/:id/asignaturas', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query(`
      SELECT da.*, a.nombre AS asignatura_nombre, a.carga_horaria,
             n.nombre AS nivel_nombre, a.id_nivel
      FROM docente_asignatura da
      JOIN asignaturas a ON a.id = da.id_asignatura
      JOIN niveles     n ON n.id = a.id_nivel
      WHERE da.id_docente = $1
      ORDER BY da.efectivo DESC, da.grado DESC, da.puntaje DESC
    `, [id]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaturas del docente' });
  }
});

// POST /api/docentes — Crear un docente
router.post('/', async (req, res) => {
  try {
    const { nombre, apellido, cedula } = req.body;
    if (!nombre || !apellido || !cedula) {
      return res.status(400).json({ error: 'nombre, apellido y cedula son obligatorios' });
    }
    const resultado = await db.query(`
      INSERT INTO docentes (nombre, apellido, cedula)
      VALUES ($1, $2, $3) RETURNING *
    `, [nombre, apellido, cedula]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un docente con la cédula "${req.body.cedula}"` });
    }
    res.status(500).json({ error: 'Error al crear el docente' });
  }
});

// PUT /api/docentes/:id — Actualizar un docente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, cedula } = req.body;
    if (!nombre || !apellido || !cedula) {
      return res.status(400).json({ error: 'nombre, apellido y cedula son obligatorios' });
    }
    const resultado = await db.query(`
      UPDATE docentes SET nombre = $1, apellido = $2, cedula = $3
      WHERE id = $4 RETURNING *
    `, [nombre, apellido, cedula, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Docente no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Ya existe un docente con la cédula "${req.body.cedula}"` });
    }
    res.status(500).json({ error: 'Error al actualizar el docente' });
  }
});

// DELETE /api/docentes/:id — Eliminar un docente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM docentes WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Docente no encontrado' });
    }
    res.json({ mensaje: 'Docente eliminado correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el docente tiene asignaciones activas' });
    }
    res.status(500).json({ error: 'Error al eliminar el docente' });
  }
});

module.exports = router;
