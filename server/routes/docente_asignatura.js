// ============================================================
// routes/docente_asignatura.js
// Relación docente ↔ asignatura (grado y puntaje)
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/docente_asignatura — Todos los registros
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT da.*, d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             a.nombre AS asignatura_nombre, n.nombre AS nivel_nombre
      FROM docente_asignatura da
      JOIN docentes    d ON d.id = da.id_docente
      JOIN asignaturas a ON a.id = da.id_asignatura
      JOIN niveles     n ON n.id = a.id_nivel
      ORDER BY da.grado DESC, da.puntaje DESC
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener docente_asignatura' });
  }
});

// GET /api/docente_asignatura/por_asignatura/:id_asignatura — Docentes de una asignatura
router.get('/por_asignatura/:id_asignatura', async (req, res) => {
  try {
    const { id_asignatura } = req.params;
    const resultado = await db.query(`
      SELECT da.*, d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             a.nombre AS asignatura_nombre, n.nombre AS nivel_nombre
      FROM docente_asignatura da
      JOIN docentes    d ON d.id = da.id_docente
      JOIN asignaturas a ON a.id = da.id_asignatura
      JOIN niveles     n ON n.id = a.id_nivel
      WHERE da.id_asignatura = $1
      ORDER BY da.grado DESC, da.puntaje DESC
    `, [id_asignatura]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener docentes de la asignatura' });
  }
});

// GET /api/docente_asignatura/:id — Un registro por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query(`
      SELECT da.*, d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             a.nombre AS asignatura_nombre
      FROM docente_asignatura da
      JOIN docentes    d ON d.id = da.id_docente
      JOIN asignaturas a ON a.id = da.id_asignatura
      WHERE da.id = $1
    `, [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});

// POST /api/docente_asignatura — Asignar asignatura a docente
router.post('/', async (req, res) => {
  try {
    const { id_docente, id_asignatura, grado, puntaje } = req.body;
    if (!id_docente || !id_asignatura || grado === undefined || puntaje === undefined) {
      return res.status(400).json({ error: 'id_docente, id_asignatura, grado y puntaje son obligatorios' });
    }
    if (grado < 1 || grado > 7) {
      return res.status(400).json({ error: 'El grado debe estar entre 1 y 7' });
    }
    if (puntaje < 0) {
      return res.status(400).json({ error: 'El puntaje no puede ser negativo' });
    }
    const resultado = await db.query(`
      INSERT INTO docente_asignatura (id_docente, id_asignatura, grado, puntaje)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id_docente, id_asignatura, grado, puntaje]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El docente ya tiene asignada esa asignatura' });
    }
    res.status(500).json({ error: 'Error al asignar la asignatura al docente' });
  }
});

// PUT /api/docente_asignatura/:id — Actualizar grado y puntaje
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { grado, puntaje } = req.body;
    if (grado === undefined || puntaje === undefined) {
      return res.status(400).json({ error: 'grado y puntaje son obligatorios' });
    }
    if (grado < 1 || grado > 7) {
      return res.status(400).json({ error: 'El grado debe estar entre 1 y 7' });
    }
    if (puntaje < 0) {
      return res.status(400).json({ error: 'El puntaje no puede ser negativo' });
    }
    const resultado = await db.query(`
      UPDATE docente_asignatura SET grado = $1, puntaje = $2
      WHERE id = $3 RETURNING *
    `, [grado, puntaje, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el registro' });
  }
});

// DELETE /api/docente_asignatura/:id — Quitar asignatura de docente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM docente_asignatura WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Asignatura desvinculada del docente correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el docente tiene asignaciones activas en grupos' });
    }
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

module.exports = router;
