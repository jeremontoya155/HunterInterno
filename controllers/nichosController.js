const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
require('dotenv').config(); // Carga las variables desde .env

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
});

// Configuración de multer para subir archivos PDF (opcional)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Guarda los archivos en la carpeta 'uploads'
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único para el archivo
  },
});
const upload = multer({ storage });

// Muestra el formulario de nicho
exports.getNichoForm = async (req, res) => {
  try {
    res.render('nicho', { message: null });
  } catch (error) {
    console.error("Error al cargar el formulario:", error);
    res.status(500).render('nicho', { message: 'Error al cargar el formulario' });
  }
};

// Procesa el formulario y guarda los datos en la BD
exports.postNicho = async (req, res) => {
  const { ubicacion, tipo_personas, edad_min, edad_max, mensaje } = req.body;
  const user_id = req.session?.user?.id; // Obtiene el ID del usuario autenticado
  const archivo_pdf = req.file ? req.file.path : null; // Ruta del archivo subido (opcional)

  // Validar que los campos obligatorios no estén vacíos
  if (!ubicacion || !tipo_personas || !mensaje) {
    return res.status(400).render('nicho', { message: 'Error: Ubicación, tipo de personas y mensaje son obligatorios' });
  }

  try {
    // Insertar el nicho en la base de datos
    await pool.query(
      `INSERT INTO nichos (user_id, ubicacion, tipo_personas, edad_min, edad_max, mensaje, archivo_pdf) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user_id,
        ubicacion || null,
        tipo_personas || null,
        edad_min || null,
        edad_max || null,
        mensaje || null,
        archivo_pdf || null,
      ]
    );

    // Redirigir según el tipo de usuario
    if (req.session.user.role === 'admin') {
      res.redirect('/nicho/asignar'); // Redirige a la vista de asignación de nichos
    } else {
      // Si no es admin, recargar la página con un mensaje de éxito
      res.render('nicho', { message: 'Nicho guardado correctamente' });
    }
  } catch (error) {
    console.error("Error al guardar el nicho:", error);
    res.status(500).render('nicho', { message: 'Error al guardar los datos' });
  }
};

// Mostrar nichos guardados con opción de asignar usuario (solo para admin)
exports.getNichosAsignar = async (req, res) => {
  try {
    // Verificar si el usuario es admin
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('nicho', { message: 'Acceso denegado: Solo para administradores' });
    }

    // Obtener los nichos y usuarios
    const resultNichos = await pool.query('SELECT * FROM nichos');
    const resultUsers = await pool.query('SELECT id, username FROM users');

    res.render('nichos_asignar', { nichos: resultNichos.rows, users: resultUsers.rows });
  } catch (error) {
    console.error("Error al cargar datos:", error);
    res.status(500).render('nichos_asignar', { nichos: [], users: [], message: 'Error al cargar datos' });
  }
};

// Asignar nicho a un usuario (solo para admin)
exports.postAsignarNicho = async (req, res) => {
  const { nicho_id, user_id } = req.body;

  // Verificar si el usuario es admin
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('nicho', { message: 'Acceso denegado: Solo para administradores' });
  }

  try {
    await pool.query('UPDATE nichos SET user_id = $1 WHERE id = $2', [user_id, nicho_id]);

    // Redirigir a la vista de asignación de nichos
    res.redirect('/nicho/asignar');
  } catch (error) {
    console.error("Error al asignar nicho:", error);
    res.status(500).redirect('/nicho/asignar');
  }
};