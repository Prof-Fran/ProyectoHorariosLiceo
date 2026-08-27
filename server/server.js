// ============================================================
// server.js — Servidor Express local
// API REST para el Sistema de Armado de Horarios
// Corre en http://localhost:3000
// ============================================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app    = express();
const PUERTO = 3000;

// ── Middlewares ──────────────────────────────────────────────
// Habilitar CORS para que el HTML pueda consumir la API
app.use(cors());
// Parsear JSON en el cuerpo de las peticiones
app.use(express.json());

// ── Rutas de la API ──────────────────────────────────────────
app.use('/api/niveles',            require('./routes/niveles'));
app.use('/api/turnos',             require('./routes/turnos'));
app.use('/api/horarios_turno',     require('./routes/horarios_turno'));
app.use('/api/grupos',             require('./routes/grupos'));
app.use('/api/asignaturas',        require('./routes/asignaturas'));
app.use('/api/docentes',           require('./routes/docentes'));
app.use('/api/docente_asignatura', require('./routes/docente_asignatura'));
app.use('/api/grupo_asignatura',   require('./routes/grupo_asignatura'));
app.use('/api/asignacion_docente', require('./routes/asignacion_docente'));
app.use('/api/disponibilidad',     require('./routes/disponibilidad'));
app.use('/api/horario_grupo',      require('./routes/horario_grupo'));
app.use('/api/vistas',             require('./routes/vistas'));

// ── Ruta de salud ────────────────────────────────────────────
app.get('/api/estado', (req, res) => {
  res.json({ estado: 'ok', mensaje: 'Servidor de Horarios activo' });
});

// ── Archivos estáticos del frontend ──────────────────────────
// Sirve index.html, dashboard.html, css/, js/, modulos/ etc.
// desde la carpeta raíz del proyecto (un nivel arriba de /server)
app.use(express.static(path.join(__dirname, '..')));

// ── Ruta raíz: redirige al login ──────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Manejo de rutas no encontradas ───────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Iniciar servidor ─────────────────────────────────────────
app.listen(PUERTO, () => {
  console.log('');
  console.log('================================================');
  console.log('  Sistema de Armado de Horarios — API Local');
  console.log(`  Aplicación:  http://localhost:${PUERTO}`);
  console.log(`  Dashboard:   http://localhost:${PUERTO}/dashboard.html`);
  console.log('================================================');
  console.log('');
});
