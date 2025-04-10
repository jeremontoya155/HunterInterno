// db.js
const { Pool } = require('pg');
require('dotenv').config(); // Para cargar las variables de entorno
console.log("Ingresmoa correctemnte")
// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI, // Usa la URI de conexión de tu .env
});

// Exportar el pool para usarlo en otros archivos
module.exports = pool;