// ============================================================
// db.js — Conexión a PostgreSQL
// Pool de conexiones reutilizable en toda la API
// ============================================================

const { Pool } = require('pg');

// Configuración de conexión local
// Modificar host/port/password si cambia el entorno
const pool = new Pool({
  host:     'localhost',
  port:     5432,
  database: 'horarios',
  user:     'postgres',
  password: '905011',
});

// Verificar conexión al iniciar
pool.connect((error, cliente, liberar) => {
  if (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error.message);
  } else {
    console.log('✅ Conexión a PostgreSQL establecida correctamente');
    liberar();
  }
});

module.exports = pool;
