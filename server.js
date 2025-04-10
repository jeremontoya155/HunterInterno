const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const nichosController = require('./controllers/nichosController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure the destination folder for uploads




const session = require('express-session');
// Importa MongoClient para conectarte a MongoDB
const { MongoClient } = require('mongodb');
require('dotenv').config(); // Carga las variables desde .env

// Cadena de conexión a MongoDB y nombre de la base de datos
const mongoUri = process.env.MONGO_URI;
const mongoDbName = 'instagram_bot';

const app = express();
const port = process.env.PORT || 3000;


// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
});

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir archivos estáticos
app.use('/static', express.static(path.join(__dirname, 'static')));

// Middleware para parsear datos de formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de sesiones
app.use(
  session({
    secret: 'clave_secreta_para_la_sesion', // Usa una clave segura en producción
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null; // Se asigna a todas las vistas
  next();
});

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}

// Rutas públicas
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const queryText =
      'SELECT * FROM users WHERE username = $1 AND password = $2';
    const { rows } = await pool.query(queryText, [username, password]);

    if (rows.length > 0) {
      req.session.user = rows[0];
      res.redirect('/onboarding');
    } else {
      res.render('login', {
        error: 'Credenciales inválidas. Intente nuevamente.',
      });
    }
  } catch (error) {
    console.error('Error en la autenticación:', error);
    res.render('login', { error: 'Error en el servidor. Intente más tarde.' });
  }
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Endpoint PUT para agregar/actualizar cuenta de Instagram en el JSON del usuario
app.put('/account', isAuthenticated, async (req, res) => {
  // Se espera que el usuario tenga un campo 'id' y un campo 'accounts' en la BD.
  const { insta_username, insta_password } = req.body;
  const userId = req.session.user.id; // Asegúrate de que en el login guardes el id

  try {
    // Obtenemos el campo accounts actual; se asume que es un arreglo JSON.
    const result = await pool.query(
      'SELECT accounts FROM users WHERE id = $1',
      [userId]
    );
    let accounts = result.rows[0].accounts;
    if (!accounts) {
      accounts = [];
    }
    // Si accounts no es un arreglo, lo convertimos (esto depende de tu modelo)
    if (!Array.isArray(accounts)) {
      accounts = [];
    }
    // Se agrega la nueva cuenta
    accounts.push({ insta_username, insta_password });

    // Se actualiza el registro en la BD
    await pool.query('UPDATE users SET accounts = $1 WHERE id = $2', [
      JSON.stringify(accounts),
      userId,
    ]);

    // Actualizamos la sesión, si es necesario, para reflejar el cambio
    req.session.user.accounts = accounts;

    res
      .status(200)
      .json({ message: 'Cuenta actualizada correctamente', accounts });
  } catch (error) {
    console.error('Error al actualizar la cuenta:', error);
    res.status(500).json({ error: 'Error al actualizar la cuenta' });
  }
});

// Rutas protegidas
app.get('/', (req, res) => {
  res.redirect('/onboarding');
});



// En tu server.js
// ... (otros requires, app, pool, isAuthenticated, etc.) ...

// --- GET /auditoria/patrimonio ---
app.get('/auditoria/patrimonio', isAuthenticated, async (req, res) => {
  // Verificación de Rol Interna (Solo Admin/Auditoría)
  const userRole = req.session.user.role;
  if (userRole !== 'admin' && userRole !== 'auditoria') {
      return res.status(403).render('error', { message: 'Acceso Denegado', error: { status: 403 }, user: req.session.user });
  }

  try {
      const result = await pool.query('SELECT * FROM patrimonio_cuentas ORDER BY tipo_cuenta, nombre_cliente, usuario');
      const cuentas = result.rows;
      const today = new Date(); // Fecha de hoy para calcular días restantes

      // Calcular días restantes para códigos de respaldo
      const cuentasConDiasRestantes = cuentas.map(cuenta => {
          let dias_restantes = null; // Por defecto es nulo
          if (cuenta.codigos_actualizados_en && cuenta.codigos_validez_dias > 0) {
              try {
                  // Asegurarse que codigos_actualizados_en es un objeto Date
                  const fechaActualizacion = new Date(cuenta.codigos_actualizados_en);
                  if (!isNaN(fechaActualizacion.getTime())) { // Validar que la fecha sea válida
                       // Clonar fecha de actualización y sumar días de validez
                      const fechaExpiracion = new Date(fechaActualizacion.getTime());
                      fechaExpiracion.setDate(fechaActualizacion.getDate() + cuenta.codigos_validez_dias);

                      // Calcular diferencia en milisegundos y luego en días (redondear hacia abajo)
                      const diffTime = fechaExpiracion.getTime() - today.getTime();
                      // Solo mostrar días restantes positivos o cero
                      dias_restantes = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                  } else {
                       console.warn(`Fecha inválida en codigos_actualizados_en para cuenta ${cuenta.usuario}`);
                  }
              } catch (dateError) {
                   console.error(`Error calculando días restantes para ${cuenta.usuario}:`, dateError);
              }
          }
          return {
              ...cuenta,
              dias_restantes_codigos: dias_restantes // Añadir la propiedad calculada
          };
      });

      res.render('auditoria_patrimonio', {
          cuentas: cuentasConDiasRestantes,
          user: req.session.user,
          success: req.query.success,
          error: req.query.error
      });

  } catch (error) {
      console.error("Error en GET /auditoria/patrimonio:", error);
      res.status(500).render('error', { message: 'Error al cargar el patrimonio de cuentas', error, user: req.session.user });
  }
});

// --- POST /auditoria/patrimonio (Para Agregar/Editar Cuenta) ---
app.post('/auditoria/patrimonio', isAuthenticated, async (req, res) => {
  // Verificación de Rol Interna (Solo Admin/Auditoría)
  const userRole = req.session.user.role;
  if (userRole !== 'admin' && userRole !== 'auditoria') {
      return res.status(403).redirect('/auditoria/patrimonio?error=Acción no permitida');
  }

  // Extraer todos los campos del formulario (modal)
  const {
      cuenta_id, // ID oculto para saber si es edición
      nombre_cliente,
      usuario,
      link,
      tipo_cuenta,
      correo,
      contrasena, // ¡¡RECORDATORIO: ENCRIPTAR!!
      verificacion, // Vendrá como 'on' o undefined si es checkbox
      celu_abierto,
      autentificador,
      codigos_respaldo,
      codigos_actualizados_en, // Fecha
      codigos_validez_dias
  } = req.body;

  // Validación básica
  if (!usuario || !tipo_cuenta) {
      return res.redirect('/auditoria/patrimonio?error=Usuario y Tipo de Cuenta son obligatorios');
  }
  // Convertir checkboxes a boolean
  const esVerificado = verificacion === 'on';
  const tieneCeluAbierto = celu_abierto === 'on';
  const tieneAutentificador = autentificador === 'on';
  // Convertir validez a número, con default
  const validezDias = parseInt(codigos_validez_dias, 10) || 7;
   // Validar fecha
   const fechaActualizacionCodigos = codigos_actualizados_en || null; // Permitir nulo si no se ingresa

  try {
      if (cuenta_id) {
          // --- Modo Edición ---
          const queryText = `
              UPDATE patrimonio_cuentas SET
                  nombre_cliente = $1, usuario = $2, link = $3, tipo_cuenta = $4, correo = $5,
                  contrasena = $6, verificacion = $7, celu_abierto = $8, autentificador = $9,
                  codigos_respaldo = $10, codigos_actualizados_en = $11, codigos_validez_dias = $12,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $13;
          `;
          await pool.query(queryText, [
              nombre_cliente || null, usuario, link || null, tipo_cuenta, correo || null,
              contrasena || null, esVerificado, tieneCeluAbierto, tieneAutentificador,
              codigos_respaldo || null, fechaActualizacionCodigos, validezDias,
              cuenta_id
          ]);
           res.redirect('/auditoria/patrimonio?success=Cuenta actualizada correctamente');
      } else {
          // --- Modo Agregar ---
          const queryText = `
              INSERT INTO patrimonio_cuentas (
                  nombre_cliente, usuario, link, tipo_cuenta, correo, contrasena,
                  verificacion, celu_abierto, autentificador, codigos_respaldo,
                  codigos_actualizados_en, codigos_validez_dias
              ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
              ) RETURNING id;
          `;
           await pool.query(queryText, [
              nombre_cliente || null, usuario, link || null, tipo_cuenta, correo || null,
              contrasena || null, esVerificado, tieneCeluAbierto, tieneAutentificador,
              codigos_respaldo || null, fechaActualizacionCodigos, validezDias
           ]);
           res.redirect('/auditoria/patrimonio?success=Cuenta agregada correctamente');
      }

  } catch (error) {
      console.error("Error en POST /auditoria/patrimonio:", error);
      // Si es error de duplicado de usuario (unique constraint)
      if (error.code === '23505' && error.constraint === 'patrimonio_cuentas_usuario_key') {
           res.redirect('/auditoria/patrimonio?error=El nombre de usuario de Instagram ya existe');
      } else {
           res.redirect(`/auditoria/patrimonio?error=Error al guardar la cuenta: ${error.message}`);
      }
  }
});

// Opcional: Endpoint DELETE (requiere JS con Fetch y método DELETE)
// app.delete('/auditoria/patrimonio/:id', isAuthenticated, async (req, res) => { ... });

// --- GET /vendedores (Modificada para Cards y Datos Agregados) ---
async function getDashboardData(startDate, endDate) {
  let totalMensajes = 0;
  let mensajesPorDia = {};
  let error = null;
  let chartData = []; // Definir chartData fuera del try para que siempre exista

  try {
      // 1. Obtener cuentas asignadas (Optimizacion: Podria cachearse si no cambia mucho)
      const vendedoresResult = await pool.query('SELECT cuentas_asignadas FROM vendedores');
      let allAssignedUsernames = [];
      vendedoresResult.rows.forEach(v => {
          if (v.cuentas_asignadas && Array.isArray(v.cuentas_asignadas)) {
              allAssignedUsernames.push(...v.cuentas_asignadas);
          }
      });
      allAssignedUsernames = [...new Set(allAssignedUsernames.map(u => u.toLowerCase()))];

      if (allAssignedUsernames.length > 0) {
          // 2. Consultar MongoDB
          const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
          await client.connect();
          const db = client.db(mongoDbName);
          const collection = db.collection('historial_acciones');

          const filter = {
              username: { $in: allAssignedUsernames },
              accion: { $regex: /mensaje/i },
              fecha: { $gte: `${startDate} 00:00:00`, $lte: `${endDate} 23:59:59` }
          };

          const pipeline = [
              { $match: filter },
              { $project: { fechaDia: { $substrCP: ["$fecha", 0, 10] } } },
              { $group: { _id: "$fechaDia", count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
              { $project: { _id: 0, fecha: "$_id", cantidad: "$count" } }
          ];
          const dailyCounts = await collection.aggregate(pipeline).toArray();

          dailyCounts.forEach(item => {
              mensajesPorDia[item.fecha] = item.cantidad;
              totalMensajes += item.cantidad;
          });
          await client.close();
      }

      // 3. Asegurar datos para cada día en el rango
      let currentDate = new Date(startDate + 'T00:00:00');
      const finalDate = new Date(endDate + 'T00:00:00');
      while (currentDate <= finalDate) {
          const dateString = currentDate.toISOString().slice(0, 10);
          chartData.push({
              fecha: dateString,
              cantidad: mensajesPorDia[dateString] || 0
          });
          currentDate.setDate(currentDate.getDate() + 1);
      }

  } catch (err) {
      console.error("Error al obtener datos del dashboard:", err);
      error = err.message;
      // En caso de error, devolver un array vacío para el gráfico
      chartData = [];
      totalMensajes = 0;
  }

  return { totalMensajes, chartData, error };
}


// --- GET /vendedores (COMPLETO Y CORREGIDO) ---
app.get('/vendedores', isAuthenticated, async (req, res) => {
  // Define fechas por defecto para el dashboard inicial (ej: último mes)
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultEndDate.getDate() - 29); // 30 días incluyendo hoy
  const initialStartDate = defaultStartDate.toISOString().slice(0, 10);
  const initialEndDate = defaultEndDate.toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10); // Definir 'hoy' aquí

  try {
      // 1. Obtener datos del dashboard inicial
      // Se llama a getDashboardData ANTES de cualquier posible error en las queries de vendedor
      const initialDashboardData = await getDashboardData(initialStartDate, initialEndDate);

      // 2. Obtener datos de vendedores
      const sqlQueryVendedores = `
          SELECT v.*,
                 COALESCE(jsonb_array_length(v.cuentas_asignadas), 0) as num_cuentas
          FROM vendedores v ORDER BY v.nombre ASC
      `;
      // console.log('DEBUG: Query Vendedores SQL:', sqlQueryVendedores);
      const vendedoresResult = await pool.query(sqlQueryVendedores);
      const vendedores = vendedoresResult.rows;
      const vendedorIds = vendedores.map(v => v.id);

      // 3. Calcular fechas y desempeño MENSUAL
      const nowForMonth = new Date(); // Usar una nueva instancia por claridad
      const year = nowForMonth.getFullYear();
      const month = nowForMonth.getMonth();
      const firstDayOfMonth = new Date(year, month, 1).toISOString().slice(0, 10);
      const lastDayOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      let desempenoMesMap = {};
      if (vendedorIds.length > 0) {
          const sqlQueryMes = `
              SELECT
                  vendedor_id,
                  SUM(mensajes_enviados) as total_mensajes_mes,
                  SUM(respuestas_recibidas) as total_respuestas_mes
              FROM vendedor_desempeno_diario
              WHERE vendedor_id = ANY($1::int[]) AND fecha >= $2 AND fecha <= $3
              GROUP BY vendedor_id;
          `;
          const desempenoMesResult = await pool.query(sqlQueryMes, [vendedorIds, firstDayOfMonth, lastDayOfMonth]);
          desempenoMesResult.rows.forEach(item => {
               desempenoMesMap[item.vendedor_id] = {
                   mensajes: parseInt(item.total_mensajes_mes, 10) || 0,
                   respuestas: parseInt(item.total_respuestas_mes, 10) || 0
               };
          });
      }

      // 4. Obtener desempeño de HOY
      const sqlQueryHoy = `
          SELECT vendedor_id, insta_username, mensajes_enviados, respuestas_recibidas
          FROM vendedor_desempeno_diario
          WHERE fecha = $1
      `;
      const desempenoHoyResult = await pool.query(sqlQueryHoy, [hoy]);
      const desempenoHoyMap = desempenoHoyResult.rows.reduce((map, item) => {
           if (!map[item.vendedor_id]) map[item.vendedor_id] = {};
           map[item.vendedor_id][item.insta_username.toLowerCase()] = {
               mensajes: item.mensajes_enviados,
               respuestas: item.respuestas_recibidas
           };
           return map;
       }, {});

      // 5. Obtener totales de MongoDB
      let allAssignedUsernames = [];
       vendedores.forEach(v => {
          if (v.cuentas_asignadas && Array.isArray(v.cuentas_asignadas)) {
               allAssignedUsernames.push(...v.cuentas_asignadas);
           }
       });
      allAssignedUsernames = [...new Set(allAssignedUsernames.map(u => u.toLowerCase()))];
      let mongoMessageCounts = {};
      if (allAssignedUsernames.length > 0) {
          const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
           try {
               await client.connect();
               const db = client.db(mongoDbName);
               const collection = db.collection('historial_acciones');
               const pipeline = [
                  { $match: { username: { $in: allAssignedUsernames }, accion: { $regex: /mensaje/i } } },
                  { $group: { _id: { $toLower: "$username" }, count: { $sum: 1 } } },
                  { $project: { _id: 0, username: "$_id", count: 1 } }
               ];
               const results = await collection.aggregate(pipeline).toArray();
               results.forEach(item => { mongoMessageCounts[item.username] = item.count; });
            } finally { await client.close(); }
      }

      // 6. Combinar datos para la vista
      const vendedoresParaVista = vendedores.map(vendedor => {
           let cuentasConDatos = [];
           let totalMensajesHoy = 0;
           let totalRespuestasHoy = 0;
           let totalMensajesMongo = 0;
           if (vendedor.cuentas_asignadas && Array.isArray(vendedor.cuentas_asignadas)) {
              cuentasConDatos = vendedor.cuentas_asignadas.map(cuenta => {
                  const cuentaLower = cuenta.toLowerCase();
                  const desempenoCuentaHoy = desempenoHoyMap[vendedor.id]?.[cuentaLower] || { mensajes: 0, respuestas: 0 };
                  const mensajesMongo = mongoMessageCounts[cuentaLower] || 0;
                  totalMensajesHoy += desempenoCuentaHoy.mensajes;
                  totalRespuestasHoy += desempenoCuentaHoy.respuestas;
                  totalMensajesMongo += mensajesMongo;
                  return { nombre: cuenta, mensajesHoy: desempenoCuentaHoy.mensajes, respuestasHoy: desempenoCuentaHoy.respuestas, mensajesMongoTotal: mensajesMongo };
              });
          }

           const objetivoMensual = vendedor.objetivo_mensual || 0;
           const mensajesEsteMes = desempenoMesMap[vendedor.id]?.mensajes || 0;
           let progresoMensualPct = 0;
           if (objetivoMensual > 0) {
               progresoMensualPct = Math.min(100, Math.max(0, (mensajesEsteMes / objetivoMensual) * 100));
           }
           return {
               ...vendedor,
               num_cuentas: vendedor.num_cuentas || 0,
               cuentasDetalle: cuentasConDatos,
               totalMensajesHoy, totalRespuestasHoy, totalMensajesMongo,
               total_mensajes_mes: mensajesEsteMes,
               progreso_mensajes_mes_pct: progresoMensualPct,
           };
      });

      // 7. Renderizar vista pasando TODAS las variables necesarias
      res.render('vendedores', {
          vendedores: vendedoresParaVista,
          user: req.session.user,
          success: req.query.success,
          // Pasar el error específico del dashboard si existe, sino el query param
          error: initialDashboardData.error ? `Error al cargar datos del dashboard: ${initialDashboardData.error}` : req.query.error,
          today: hoy,
          initialDashboard: initialDashboardData, // Objeto { totalMensajes, chartData, error }
          initialStartDate: initialStartDate,     // String YYYY-MM-DD
          initialEndDate: initialEndDate          // String YYYY-MM-DD
      });

  } catch (error) {
      // Captura errores de las queries de vendedor o cualquier otro error inesperado
      console.error("Error severo en GET /vendedores:", error);
      res.status(500).render('error', {
           message: 'Error al cargar la página de vendedores',
           error: error, // Pasar el error para depuración (si error.ejs lo maneja)
           user: req.session.user
         });
  }
});
// --- NUEVO ENDPOINT: GET /vendedores/dashboard-data (para AJAX) ---
app.get('/vendedores/dashboard-data', isAuthenticated, async (req, res) => {
  const { from, to } = req.query;

  // Validar fechas (básico)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ error: 'Fechas inválidas o faltantes (YYYY-MM-DD)' });
  }

  const dashboardData = await getDashboardData(from, to);

  if (dashboardData.error) {
      return res.status(500).json({ error: `Error al obtener datos del dashboard: ${dashboardData.error}` });
  }

  res.json(dashboardData); // Devuelve { totalMensajes, chartData }
});


// --- POST /vendedores (Para Crear/Editar Vendedor - Desde Modal) ---
app.post('/vendedores', isAuthenticated, async (req, res) => {
  // Verificación de Rol Interna (Admin/Auditoría)
  const userRole = req.session.user.role;
  if (userRole !== 'admin' && userRole !== 'auditoria') {
      return res.status(403).send('Acción no permitida para tu rol.'); // O redirigir con error
  }

  // Extraer datos del body (del modal)
  const {
      vendedor_id, nombre, cuentas_asignadas, porcentaje_cumplimiento, fecha_ingreso,
      estado, notas_auditoria, objetivo_mensual, manager_asignado
  } = req.body;

  // ... (Validación y procesamiento de datos igual que antes) ...
  if (!nombre) return res.redirect('/vendedores?error=El nombre es obligatorio');
  let cuentasArray = [];
  // ... (procesar cuentas_asignadas a cuentasJson) ...
   if (cuentas_asignadas && typeof cuentas_asignadas === 'string') {
        cuentasArray = cuentas_asignadas.split(',').map(c => c.trim().toLowerCase()).filter(c => c !== '');
   }
  const cuentasJson = JSON.stringify(cuentasArray);
  const cumplimiento = parseFloat(porcentaje_cumplimiento) || 0.00;
  const objetivo = parseInt(objetivo_mensual, 10) || 0;
  const ingreso = fecha_ingreso || null;

  try {
      if (vendedor_id) { // Actualizar
          const queryText = `
              UPDATE vendedores SET nombre = $1, cuentas_asignadas = $2, porcentaje_cumplimiento = $3, fecha_ingreso = $4,
              estado = $5, notas_auditoria = $6, objetivo_mensual = $7, manager_asignado = $8, updated_at = CURRENT_TIMESTAMP
              WHERE id = $9;
          `;
          await pool.query(queryText, [
              nombre, cuentasJson, cumplimiento, ingreso, estado, notas_auditoria,
              objetivo, manager_asignado, vendedor_id
          ]);
          res.redirect('/vendedores?success=Vendedor actualizado');
      } else { // Crear
          const queryText = `
              INSERT INTO vendedores (nombre, cuentas_asignadas, porcentaje_cumplimiento, fecha_ingreso, estado, notas_auditoria, objetivo_mensual, manager_asignado)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
          `;
          await pool.query(queryText, [
              nombre, cuentasJson, cumplimiento, ingreso, estado, notas_auditoria, objetivo, manager_asignado
          ]);
          res.redirect('/vendedores?success=Vendedor agregado');
      }
  } catch (error) {
      console.error("Error en POST /vendedores:", error);
      res.redirect(`/vendedores?error=Error al guardar: ${error.message}`);
  }
});

// --- NUEVO: POST /vendedores/desempeno (Para Registrar Desempeño Diario) ---
app.post('/vendedores/desempeno', isAuthenticated, async (req, res) => {
  // Verificación de Rol (Admin/Auditoría pueden registrar)
  const userRole = req.session.user.role;
  if (userRole !== 'admin' && userRole !== 'auditoria') {
      // Podrías devolver un JSON si lo llamas con AJAX
      return res.status(403).json({ success: false, message: 'Acción no permitida.' });
  }

  const { vendedor_id, fecha, desempeno } = req.body; // 'desempeno' será un array de objetos: [{cuenta: 'user1', mensajes: 10, respuestas: 2}, ...]

  if (!vendedor_id || !fecha || !Array.isArray(desempeno) || desempeno.length === 0) {
      return res.status(400).json({ success: false, message: 'Datos incompletos.' });
  }

  const client = await pool.connect(); // Usar transacción
  try {
      await client.query('BEGIN'); // Iniciar transacción

      for (const item of desempeno) {
          const cuenta = item.cuenta?.trim().toLowerCase();
          const mensajes = parseInt(item.mensajes, 10) || 0;
          const respuestas = parseInt(item.respuestas, 10) || 0;

          if (!cuenta) continue; // Saltar si no hay nombre de cuenta

          const queryText = `
              INSERT INTO vendedor_desempeno_diario (vendedor_id, fecha, insta_username, mensajes_enviados, respuestas_recibidas)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (vendedor_id, fecha, insta_username) DO UPDATE SET
                  mensajes_enviados = vendedor_desempeno_diario.mensajes_enviados + EXCLUDED.mensajes_enviados, -- O simplemente = EXCLUDED.mensajes_enviados si quieres sobreescribir
                  respuestas_recibidas = vendedor_desempeno_diario.respuestas_recibidas + EXCLUDED.respuestas_recibidas, -- O = EXCLUDED.respuestas_recibidas
                  updated_at = CURRENT_TIMESTAMP;
          `;
          // OJO: Aquí estoy SUMANDO los valores enviados a los existentes. Si quieres SOBREESCRIBIR, usa:
          // mensajes_enviados = EXCLUDED.mensajes_enviados,
          // respuestas_recibidas = EXCLUDED.respuestas_recibidas,
          await client.query(queryText, [vendedor_id, fecha, cuenta, mensajes, respuestas]);
      }

      await client.query('COMMIT'); // Confirmar transacción
      // Si usas AJAX, devuelve JSON. Si no, redirige.
      res.json({ success: true, message: 'Desempeño registrado/actualizado.' });
      // O redirigir: res.redirect('/vendedores?success=Desempeño registrado');

  } catch (error) {
      await client.query('ROLLBACK'); // Revertir en caso de error
      console.error("Error en POST /vendedores/desempeno:", error);
      res.status(500).json({ success: false, message: `Error al registrar desempeño: ${error.message}` });
      // O redirigir: res.redirect(`/vendedores?error=Error al registrar desempeño`);
  } finally {
      client.release(); // Liberar cliente de la pool
  }
});


// --- NUEVO: GET /vendedores/:id/historial ---
app.get('/vendedores/:id/historial', isAuthenticated, async (req, res) => {
  const vendedorId = req.params.id;
  // Opcional: Verificar rol si solo admin/auditoria pueden ver historial
  // const userRole = req.session.user.role;
  // if (userRole !== 'admin' && userRole !== 'auditoria') {
  //     return res.status(403).render('error', {message: 'Acceso denegado', error: {}, user: req.session.user});
  // }

  try {
      // 1. Obtener datos del vendedor
      const vendedorResult = await pool.query('SELECT * FROM vendedores WHERE id = $1', [vendedorId]);
      if (vendedorResult.rows.length === 0) {
          return res.status(404).render('error', {message: 'Vendedor no encontrado', error: {}, user: req.session.user});
      }
      const vendedor = vendedorResult.rows[0];

      // 2. Obtener historial de desempeño ordenado
      const historialResult = await pool.query(`
          SELECT fecha, insta_username, mensajes_enviados, respuestas_recibidas
          FROM vendedor_desempeno_diario
          WHERE vendedor_id = $1
          ORDER BY fecha DESC, insta_username ASC
      `, [vendedorId]);
      const historial = historialResult.rows;

      // 3. (Opcional) Agrupar por fecha para la vista
      const historialAgrupado = historial.reduce((acc, item) => {
          const fechaStr = item.fecha.toISOString().slice(0, 10);
          if (!acc[fechaStr]) {
              acc[fechaStr] = { fecha: fechaStr, entradas: [] };
          }
          acc[fechaStr].entradas.push(item);
          return acc;
      }, {});


      res.render('vendedor_historial', {
          vendedor: vendedor,
          historial: Object.values(historialAgrupado).sort((a,b) => b.fecha.localeCompare(a.fecha)), // Ordena por fecha descendente
          user: req.session.user
          // Puedes pasar datos para gráficos aquí si los implementas
      });

  } catch (error) {
      console.error(`Error en GET /vendedores/${vendedorId}/historial:`, error);
      res.status(500).render('error', { message: 'Error al cargar historial', error, user: req.session.user });
  }
});



app.get('/onboarding', isAuthenticated, (req, res) => {
  res.render('onboarding');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
