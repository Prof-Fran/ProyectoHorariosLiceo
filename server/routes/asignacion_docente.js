// ============================================================
// routes/asignacion_docente.js
// Docente asignado a una asignatura dentro de un grupo
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/asignacion_docente — Todas las asignaciones
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT ad.*, g.numero AS grupo_numero,
             n.nombre AS nivel_nombre, t.nombre AS turno_nombre,
             a.nombre AS asignatura_nombre,
             d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             da.grado, da.puntaje, da.efectivo
      FROM asignacion_docente ad
      JOIN grupos              g  ON g.id  = ad.id_grupo
      JOIN niveles             n  ON n.id  = g.id_nivel
      JOIN turnos              t  ON t.id  = g.id_turno
      JOIN asignaturas         a  ON a.id  = ad.id_asignatura
      JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
      JOIN docentes            d  ON d.id  = da.id_docente
      ORDER BY n.nombre, g.numero, a.nombre
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaciones de docente' });
  }
});

// GET /api/asignacion_docente/por_grupo/:id_grupo — Asignaciones de un grupo
router.get('/por_grupo/:id_grupo', async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const resultado = await db.query(`
      SELECT ad.*, a.nombre AS asignatura_nombre,
             d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             da.grado, da.puntaje, da.efectivo
      FROM asignacion_docente ad
      JOIN asignaturas        a  ON a.id  = ad.id_asignatura
      JOIN docente_asignatura da ON da.id = ad.id_docente_asignatura
      JOIN docentes           d  ON d.id  = da.id_docente
      WHERE ad.id_grupo = $1
      ORDER BY a.nombre
    `, [id_grupo]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asignaciones del grupo' });
  }
});

// GET /api/asignacion_docente/:id — Una asignación por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query(`
      SELECT ad.*, a.nombre AS asignatura_nombre,
             d.nombre AS docente_nombre, d.apellido AS docente_apellido
      FROM asignacion_docente ad
      JOIN asignaturas        a  ON a.id  = ad.id_asignatura
      JOIN docente_asignatura da ON da.id = ad.id_docente_asignatura
      JOIN docentes           d  ON d.id  = da.id_docente
      WHERE ad.id = $1
    `, [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la asignación' });
  }
});

// POST /api/asignacion_docente — Asignar docente a asignatura en grupo
router.post('/', async (req, res) => {
  try {
    const { id_grupo, id_asignatura, id_docente_asignatura } = req.body;
    if (!id_grupo || !id_asignatura || !id_docente_asignatura) {
      return res.status(400).json({ error: 'id_grupo, id_asignatura e id_docente_asignatura son obligatorios' });
    }

    // Verificar que la asignatura corresponde al nivel del grupo
    const verificacion = await db.query(`
      SELECT g.id_nivel, a.id_nivel AS nivel_asignatura
      FROM grupos g, asignaturas a
      WHERE g.id = $1 AND a.id = $2
    `, [id_grupo, id_asignatura]);

    if (verificacion.rows.length > 0) {
      const { id_nivel, nivel_asignatura } = verificacion.rows[0];
      if (id_nivel !== nivel_asignatura) {
        return res.status(400).json({
          error: 'La asignatura no pertenece al nivel del grupo'
        });
      }
    }

    const resultado = await db.query(`
      INSERT INTO asignacion_docente (id_grupo, id_asignatura, id_docente_asignatura)
      VALUES ($1, $2, $3) RETURNING *
    `, [id_grupo, id_asignatura, id_docente_asignatura]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un docente asignado a esa asignatura en ese grupo' });
    }
    res.status(500).json({ error: 'Error al crear la asignación' });
  }
});

// PUT /api/asignacion_docente/:id — Cambiar docente asignado
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_docente_asignatura } = req.body;
    if (!id_docente_asignatura) {
      return res.status(400).json({ error: 'id_docente_asignatura es obligatorio' });
    }
    const resultado = await db.query(`
      UPDATE asignacion_docente SET id_docente_asignatura = $1
      WHERE id = $2 RETURNING *
    `, [id_docente_asignatura, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la asignación' });
  }
});

// DELETE /api/asignacion_docente/:id — Quitar docente del grupo/asignatura
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM asignacion_docente WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }
    res.json({ mensaje: 'Asignación de docente eliminada correctamente' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el docente tiene bloques en el horario del grupo' });
    }
    res.status(500).json({ error: 'Error al eliminar la asignación' });
  }
});

module.exports = router;
