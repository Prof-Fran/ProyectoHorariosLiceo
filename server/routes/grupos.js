// ============================================================
// routes/grupos.js — CRUD de grupos
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/grupos — Todos los grupos (con nivel y turno)
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT g.*, n.nombre AS nivel_nombre, t.nombre AS turno_nombre
      FROM grupos g
      JOIN niveles n ON n.id = g.id_nivel
      JOIN turnos  t ON t.id = g.id_turno
      ORDER BY n.nombre, g.numero
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

// GET /api/grupos/por_nivel/:id_nivel — Grupos de un nivel
router.get('/por_nivel/:id_nivel', async (req, res) => {
  try {
    const { id_nivel } = req.params;
    const resultado = await db.query(`
      SELECT g.*, n.nombre AS nivel_nombre, t.nombre AS turno_nombre
      FROM grupos g
      JOIN niveles n ON n.id = g.id_nivel
      JOIN turnos  t ON t.id = g.id_turno
      WHERE g.id_nivel = $1
      ORDER BY g.numero
    `, [id_nivel]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener grupos del nivel' });
  }
});

// GET /api/grupos/:id — Un grupo por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query(`
      SELECT g.*, n.nombre AS nivel_nombre, t.nombre AS turno_nombre
      FROM grupos g
      JOIN niveles n ON n.id = g.id_nivel
      JOIN turnos  t ON t.id = g.id_turno
      WHERE g.id = $1
    `, [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el grupo' });
  }
});

// POST /api/grupos — Crear un grupo
router.post('/', async (req, res) => {
  try {
    const { id_nivel, id_turno, numero } = req.body;
    if (!id_nivel || !id_turno || !numero) {
      return res.status(400).json({ error: 'id_nivel, id_turno y numero son obligatorios' });
    }
    if (numero <= 0) {
      return res.status(400).json({ error: 'El número de grupo debe ser mayor a 0' });
    }
    const resultado = await db.query(`
      INSERT INTO grupos (id_nivel, id_turno, numero)
      VALUES ($1, $2, $3) RETURNING *
    `, [id_nivel, id_turno, numero]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un grupo con ese nivel, turno y número' });
    }
    res.status(500).json({ error: 'Error al crear el grupo' });
  }
});

// PUT /api/grupos/:id — Actualizar un grupo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_nivel, id_turno, numero } = req.body;
    if (!id_nivel || !id_turno || !numero) {
      return res.status(400).json({ error: 'id_nivel, id_turno y numero son obligatorios' });
    }
    const resultado = await db.query(`
      UPDATE grupos SET id_nivel = $1, id_turno = $2, numero = $3
      WHERE id = $4 RETURNING *
    `, [id_nivel, id_turno, numero, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un grupo con ese nivel, turno y número' });
    }
    res.status(500).json({ error: 'Error al actualizar el grupo' });
  }
});

// DELETE /api/grupos/:id — Eliminar un grupo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM grupos WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.json({ mensaje: 'Grupo eliminado correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene horarios o asignaciones activas' });
    }
    res.status(500).json({ error: 'Error al eliminar el grupo' });
  }
});

module.exports = router;
