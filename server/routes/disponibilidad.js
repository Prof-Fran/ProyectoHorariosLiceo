// ============================================================
// routes/disponibilidad.js
// Horarios ocupados del docente en otras instituciones
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/disponibilidad — Todos los registros
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT dd.*, d.nombre AS docente_nombre, d.apellido AS docente_apellido
      FROM disponibilidad_docente dd
      JOIN docentes d ON d.id = dd.id_docente
      ORDER BY dd.id_docente, dd.dia_semana, dd.numero_hora
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// GET /api/disponibilidad/por_docente/:id_docente — Disponibilidad de un docente
router.get('/por_docente/:id_docente', async (req, res) => {
  try {
    const { id_docente } = req.params;
    const resultado = await db.query(`
      SELECT * FROM disponibilidad_docente
      WHERE id_docente = $1
      ORDER BY dia_semana, numero_hora
    `, [id_docente]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disponibilidad del docente' });
  }
});

// GET /api/disponibilidad/:id — Un registro por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM disponibilidad_docente WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});

// POST /api/disponibilidad — Marcar un bloque como ocupado
router.post('/', async (req, res) => {
  try {
    const { id_docente, dia_semana, numero_hora, ocupado } = req.body;
    if (!id_docente || !dia_semana || !numero_hora) {
      return res.status(400).json({ error: 'id_docente, dia_semana y numero_hora son obligatorios' });
    }
    if (dia_semana < 1 || dia_semana > 5) {
      return res.status(400).json({ error: 'dia_semana debe estar entre 1 (lunes) y 5 (viernes)' });
    }
    if (numero_hora <= 0) {
      return res.status(400).json({ error: 'numero_hora debe ser mayor a 0' });
    }

    const estaOcupado = ocupado !== undefined ? ocupado : true;

    const resultado = await db.query(`
      INSERT INTO disponibilidad_docente (id_docente, dia_semana, numero_hora, ocupado)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id_docente, dia_semana, numero_hora, estaOcupado]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un registro para ese docente, día y hora' });
    }
    res.status(500).json({ error: 'Error al registrar disponibilidad' });
  }
});

// PUT /api/disponibilidad/:id — Actualizar estado de un bloque
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ocupado } = req.body;
    if (ocupado === undefined) {
      return res.status(400).json({ error: 'ocupado es obligatorio (true o false)' });
    }
    const resultado = await db.query(`
      UPDATE disponibilidad_docente SET ocupado = $1 WHERE id = $2 RETURNING *
    `, [ocupado, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar disponibilidad' });
  }
});

// PUT /api/disponibilidad/upsert — Crear o actualizar (usado desde la grilla)
// Body: { id_docente, dia_semana, numero_hora, ocupado }
router.put('/upsert', async (req, res) => {
  try {
    const { id_docente, dia_semana, numero_hora, ocupado } = req.body;
    if (!id_docente || !dia_semana || !numero_hora || ocupado === undefined) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    const resultado = await db.query(`
      INSERT INTO disponibilidad_docente (id_docente, dia_semana, numero_hora, ocupado)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id_docente, dia_semana, numero_hora)
      DO UPDATE SET ocupado = EXCLUDED.ocupado
      RETURNING *
    `, [id_docente, dia_semana, numero_hora, ocupado]);
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar disponibilidad' });
  }
});

// DELETE /api/disponibilidad/:id — Eliminar un registro
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM disponibilidad_docente WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la disponibilidad' });
  }
});

module.exports = router;
