// ============================================================
// routes/grupo_asignatura.js
// Asignaturas que pertenecen a cada grupo
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/grupo_asignatura — Todos los registros
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT ga.*, a.nombre AS asignatura_nombre, a.carga_horaria,
             n.nombre AS nivel_nombre
      FROM grupo_asignatura ga
      JOIN asignaturas a ON a.id = ga.id_asignatura
      JOIN niveles     n ON n.id = a.id_nivel
      ORDER BY ga.id_grupo, a.nombre
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener grupo_asignatura' });
  }
});

// GET /api/grupo_asignatura/por_grupo/:id_grupo — Asignaturas de un grupo
router.get('/por_grupo/:id_grupo', async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const resultado = await db.query(`
      SELECT ga.*, a.nombre AS asignatura_nombre, a.carga_horaria,
             n.nombre AS nivel_nombre
      FROM grupo_asignatura ga
      JOIN asignaturas a ON a.id = ga.id_asignatura
      JOIN niveles     n ON n.id = a.id_nivel
      WHERE ga.id_grupo = $1
      ORDER BY a.nombre
    `, [id_grupo]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaturas del grupo' });
  }
});

// GET /api/grupo_asignatura/:id — Un registro por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM grupo_asignatura WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});

// POST /api/grupo_asignatura — Agregar asignatura a grupo
router.post('/', async (req, res) => {
  try {
    const { id_grupo, id_asignatura } = req.body;
    if (!id_grupo || !id_asignatura) {
      return res.status(400).json({ error: 'id_grupo e id_asignatura son obligatorios' });
    }
    const resultado = await db.query(`
      INSERT INTO grupo_asignatura (id_grupo, id_asignatura)
      VALUES ($1, $2) RETURNING *
    `, [id_grupo, id_asignatura]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'La asignatura ya está asignada a ese grupo' });
    }
    res.status(500).json({ error: 'Error al agregar la asignatura al grupo' });
  }
});

// DELETE /api/grupo_asignatura/:id — Quitar asignatura de grupo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM grupo_asignatura WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Asignatura desvinculada del grupo correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene asignaciones de docente activas' });
    }
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

module.exports = router;
