// ============================================================
// routes/vistas.js — Endpoints sobre las vistas SQL
// Consultas optimizadas para el armado de horarios
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/vistas/docentes_por_asignatura
// Lista docentes ordenados por grado y puntaje (panel derecho del armado)
router.get('/docentes_por_asignatura', async (req, res) => {
  try {
    const resultado = await db.query('SELECT * FROM vista_docentes_por_asignatura');
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vista de docentes' });
  }
});

// GET /api/vistas/docentes_por_asignatura/:id_asignatura
// Docentes de una asignatura específica, ordenados para el armado
router.get('/docentes_por_asignatura/:id_asignatura', async (req, res) => {
  try {
    const { id_asignatura } = req.params;
    const resultado = await db.query(
      'SELECT * FROM vista_docentes_por_asignatura WHERE id_asignatura = $1',
      [id_asignatura]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener docentes de la asignatura' });
  }
});

// GET /api/vistas/horas_grupo/:id_grupo
// Horas asignadas y restantes por asignatura en un grupo (contadores del armado)
router.get('/horas_grupo/:id_grupo', async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const resultado = await db.query(
      'SELECT * FROM vista_horas_grupo WHERE id_grupo = $1',
      [id_grupo]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener horas del grupo' });
  }
});

// GET /api/vistas/docente_ocupado/:id_docente
// Bloques ocupados de un docente (internos + externos) para detectar conflictos
router.get('/docente_ocupado/:id_docente', async (req, res) => {
  try {
    const { id_docente } = req.params;
    const resultado = await db.query(
      'SELECT * FROM vista_docente_ocupado WHERE id_docente = $1 ORDER BY id_turno, dia_semana, numero_hora',
      [id_docente]
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener bloques ocupados del docente' });
  }
});

module.exports = router;
