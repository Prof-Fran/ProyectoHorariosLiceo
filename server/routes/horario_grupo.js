// ============================================================
// routes/horario_grupo.js — Tabla principal del sistema
// Almacena el horario definitivo de cada grupo
// Contiene todas las validaciones de negocio críticas
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Función auxiliar: obtener id_docente a partir de id_grupo_docente ──
async function obtenerIdDocente(idGrupoDocente) {
  const resultado = await db.query(`
    SELECT da.id_docente
    FROM asignacion_docente ad
    JOIN docente_asignatura da ON da.id = ad.id_docente_asignatura
    WHERE ad.id = $1
  `, [idGrupoDocente]);
  if (resultado.rows.length === 0) return null;
  return resultado.rows[0].id_docente;
}

// ── Función auxiliar: validar todas las reglas antes de insertar ──
async function validarInsercion({ idGrupo, diaSemana, numeroHora, idGrupoDocente, ordenDupla }) {
  const idDocente = await obtenerIdDocente(idGrupoDocente);
  if (!idDocente) {
    return { valido: false, mensaje: 'La asignación de docente indicada no existe' };
  }

  // Regla 1: verificar que el docente no esté ocupado externamente
  const ocupadoExterno = await db.query(`
    SELECT id FROM disponibilidad_docente
    WHERE id_docente = $1 AND dia_semana = $2 AND numero_hora = $3 AND ocupado = TRUE
  `, [idDocente, diaSemana, numeroHora]);

  if (ocupadoExterno.rows.length > 0) {
    return {
      valido: false,
      mensaje: 'El docente está ocupado en otra institución en ese horario'
    };
  }

  // Regla 2: verificar que el docente no esté ya asignado en otro grupo en ese horario
  const ocupadoInterno = await db.query(`
    SELECT hg.id_grupo FROM horario_grupo hg
    JOIN asignacion_docente  ad ON ad.id = hg.id_grupo_docente
    JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
    WHERE da.id_docente = $1
      AND hg.dia_semana  = $2
      AND hg.numero_hora = $3
      AND hg.id_grupo   != $4
  `, [idDocente, diaSemana, numeroHora, idGrupo]);

  if (ocupadoInterno.rows.length > 0) {
    return {
      valido: false,
      mensaje: 'El docente ya está asignado en otro grupo en ese horario'
    };
  }

  // Regla 3: verificar que no haya más de 2 asignaturas en la celda (dupla)
  const celdasOcupadas = await db.query(`
    SELECT COUNT(*) AS cantidad FROM horario_grupo
    WHERE id_grupo = $1 AND dia_semana = $2 AND numero_hora = $3
  `, [idGrupo, diaSemana, numeroHora]);

  const cantidadCelda = parseInt(celdasOcupadas.rows[0].cantidad);
  if (cantidadCelda >= 2) {
    return {
      valido: false,
      mensaje: 'La celda ya tiene 2 asignaturas (dupla completa). No se puede agregar más'
    };
  }

  // Regla 4: verificar que no se supere la carga horaria de la asignatura
  const cargaHoraria = await db.query(`
    SELECT a.carga_horaria, COUNT(hg.id) AS horas_asignadas
    FROM asignacion_docente ad
    JOIN asignaturas        a  ON a.id = ad.id_asignatura
    LEFT JOIN horario_grupo hg ON hg.id_grupo = ad.id_grupo
                               AND hg.id_grupo_docente = ad.id
    WHERE ad.id = $1
    GROUP BY a.carga_horaria
  `, [idGrupoDocente]);

  if (cargaHoraria.rows.length > 0) {
    const { carga_horaria, horas_asignadas } = cargaHoraria.rows[0];
    if (parseInt(horas_asignadas) >= parseInt(carga_horaria)) {
      return {
        valido: false,
        mensaje: `La asignatura ya tiene todas sus horas asignadas (${carga_horaria}h)`
      };
    }
  }

  // Regla 5: si es una dupla (orden_dupla=2), verificar que el grupo no tenga ya 2 duplas
  if (ordenDupla === 2 || cantidadCelda === 1) {
    const duplasPorGrupo = await db.query(`
      SELECT COUNT(*) AS total_duplas FROM (
        SELECT dia_semana, numero_hora
        FROM horario_grupo
        WHERE id_grupo = $1
        GROUP BY dia_semana, numero_hora
        HAVING COUNT(*) = 2
      ) sub
    `, [idGrupo]);

    const totalDuplas = parseInt(duplasPorGrupo.rows[0].total_duplas);
    if (totalDuplas >= 2) {
      return {
        valido: false,
        mensaje: 'El grupo ya tiene el máximo de 2 duplas permitidas'
      };
    }
  }

  return { valido: true };
}

// ── Endpoints ─────────────────────────────────────────────────

// GET /api/horario_grupo — Todo el horario (con detalles)
router.get('/', async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT hg.*,
             g.numero AS grupo_numero, n.nombre AS nivel_nombre, t.nombre AS turno_nombre,
             a.nombre AS asignatura_nombre,
             d.nombre AS docente_nombre, d.apellido AS docente_apellido,
             da.id AS id_docente_asignatura
      FROM horario_grupo hg
      JOIN grupos              g  ON g.id  = hg.id_grupo
      JOIN niveles             n  ON n.id  = g.id_nivel
      JOIN turnos              t  ON t.id  = g.id_turno
      JOIN asignacion_docente  ad ON ad.id = hg.id_grupo_docente
      JOIN asignaturas         a  ON a.id  = ad.id_asignatura
      JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
      JOIN docentes            d  ON d.id  = da.id_docente
      ORDER BY hg.id_grupo, hg.dia_semana, hg.numero_hora, hg.orden_dupla
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el horario' });
  }
});

// GET /api/horario_grupo/por_grupo/:id_grupo — Horario de un grupo específico
router.get('/por_grupo/:id_grupo', async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const resultado = await db.query(`
      SELECT hg.*,
             a.nombre AS asignatura_nombre, a.id AS id_asignatura,
             d.nombre AS docente_nombre, d.apellido AS docente_apellido, d.id AS id_docente,
             ad.id AS id_asignacion
      FROM horario_grupo hg
      JOIN asignacion_docente  ad ON ad.id = hg.id_grupo_docente
      JOIN asignaturas         a  ON a.id  = ad.id_asignatura
      JOIN docente_asignatura  da ON da.id = ad.id_docente_asignatura
      JOIN docentes            d  ON d.id  = da.id_docente
      WHERE hg.id_grupo = $1
      ORDER BY hg.dia_semana, hg.numero_hora, hg.orden_dupla
    `, [id_grupo]);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el horario del grupo' });
  }
});

// GET /api/horario_grupo/:id — Un registro por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('SELECT * FROM horario_grupo WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
});

// POST /api/horario_grupo — Insertar asignación en el horario (con validaciones)
router.post('/', async (req, res) => {
  try {
    const { id_grupo, dia_semana, numero_hora, id_grupo_docente, orden_dupla } = req.body;

    if (!id_grupo || !dia_semana || !numero_hora || !id_grupo_docente) {
      return res.status(400).json({
        error: 'id_grupo, dia_semana, numero_hora e id_grupo_docente son obligatorios'
      });
    }
    if (dia_semana < 1 || dia_semana > 5) {
      return res.status(400).json({ error: 'dia_semana debe estar entre 1 y 5' });
    }

    const dupla = orden_dupla || 1;

    // Ejecutar todas las validaciones de negocio
    const validacion = await validarInsercion({
      idGrupo: id_grupo,
      diaSemana: dia_semana,
      numeroHora: numero_hora,
      idGrupoDocente: id_grupo_docente,
      ordenDupla: dupla
    });

    if (!validacion.valido) {
      return res.status(422).json({ error: validacion.mensaje });
    }

    const resultado = await db.query(`
      INSERT INTO horario_grupo (id_grupo, dia_semana, numero_hora, id_grupo_docente, orden_dupla)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [id_grupo, dia_semana, numero_hora, id_grupo_docente, dupla]);

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un registro para esa celda con ese orden de dupla' });
    }
    res.status(500).json({ error: 'Error al insertar en el horario' });
  }
});

// DELETE /api/horario_grupo/:id — Quitar asignación del horario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.query('DELETE FROM horario_grupo WHERE id = $1 RETURNING *', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Asignación eliminada del horario correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar del horario' });
  }
});

// DELETE /api/horario_grupo/celda/:id_grupo/:dia/:hora — Vaciar una celda completa
router.delete('/celda/:id_grupo/:dia/:hora', async (req, res) => {
  try {
    const { id_grupo, dia, hora } = req.params;
    await db.query(`
      DELETE FROM horario_grupo
      WHERE id_grupo = $1 AND dia_semana = $2 AND numero_hora = $3
    `, [id_grupo, dia, hora]);
    res.json({ mensaje: 'Celda vaciada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al vaciar la celda' });
  }
});

module.exports = router;
