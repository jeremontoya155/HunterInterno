    const express = require('express');
    const path = require('path');
    const { Pool } = require('pg');
    const nichosController = require('./controllers/nichosController');

    const multer = require('multer');
    const fs = require('fs'); // Necesario para operaciones de archivo como verificar existencia

    // Asegúrate de que el directorio 'uploads/' exista
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }

    // Configuración de Multer (puedes personalizar storage si quieres más control sobre nombres/rutas)
    const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
        // Generar un nombre único para evitar colisiones y problemas de seguridad
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname); // Obtener extensión original
        cb(null, file.fieldname + '-' + uniqueSuffix + extension); // Ej: csvFile-1678886400000-123456789.csv
    }
    });

    // Filtro para aceptar solo archivos CSV
    const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
        cb(null, true); // Aceptar archivo
    } else {
        cb(new Error('Solo se permiten archivos CSV.'), false); // Rechazar archivo
    }
    };

    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB (ajusta según necesites)
    });

    // ... resto de tu configuración de express, pool, session, etc. ...

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

    async function getCrecimientoDataSimple(filters) { /* ... (sin cambios) ... */ }
    // --- GET /crecimiento ---
    app.get('/crecimiento', isAuthenticated, (req, res, next) => { /* ... (sin cambios, renderiza la vista) ... */ });
    // --- GET /api/crecimiento/data ---
    app.get('/api/crecimiento/data', isAuthenticated, async (req, res, next) => { /* ... (sin cambios) ... */ });

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
    // Extraer todos los campos del formulario
    const {
        cuenta_id,
        nombre_cliente,
        usuario,
        link,
        tipo_cuenta,
        correo,
        contrasena,
        verificacion,
        celu_abierto,
        autentificador,
        codigos_respaldo,
        codigos_actualizados_en,
        codigos_validez_dias,
        celular, // Nuevo campo
        ultima_carga_celular, // Nuevo campo
        contrasena_mail // Nuevo campo
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

    try {
        if (cuenta_id) {
            // Modo Edición
            const queryText = `
                UPDATE patrimonio_cuentas SET
                    nombre_cliente = $1, usuario = $2, link = $3, tipo_cuenta = $4, 
                    correo = $5, contrasena = $6, verificacion = $7, celu_abierto = $8, 
                    autentificador = $9, codigos_respaldo = $10, codigos_actualizados_en = $11, 
                    codigos_validez_dias = $12, celular = $13, ultima_carga_celular = $14,
                    contrasena_mail = $15, updated_at = CURRENT_TIMESTAMP
                WHERE id = $16;
            `;
            await pool.query(queryText, [
                nombre_cliente || null, usuario, link || null, tipo_cuenta, 
                correo || null, contrasena || null, esVerificado, tieneCeluAbierto, 
                tieneAutentificador, codigos_respaldo || null, ultima_carga_celular || null, 
                validezDias, celular || null, ultima_carga_celular || null,
                contrasena_mail || null, cuenta_id
            ]);
            res.redirect('/auditoria/patrimonio?success=Cuenta actualizada correctamente');
        } else {
            // Modo Agregar
            const queryText = `
                INSERT INTO patrimonio_cuentas (
                    nombre_cliente, usuario, link, tipo_cuenta, correo, contrasena,
                    verificacion, celu_abierto, autentificador, codigos_respaldo,
                    codigos_actualizados_en, codigos_validez_dias, celular,
                    ultima_carga_celular, contrasena_mail
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                ) RETURNING id;
            `;
            await pool.query(queryText, [
                nombre_cliente || null, usuario, link || null, tipo_cuenta, correo || null,
                contrasena || null, esVerificado, tieneCeluAbierto, tieneAutentificador,
                codigos_respaldo || null, codigos_actualizados_en || null, validezDias,
                celular || null, ultima_carga_celular || null, contrasena_mail || null
            ]);
            res.redirect('/auditoria/patrimonio?success=Cuenta agregada correctamente');
        }
    } catch (error) {
        console.error("Error en POST /auditoria/patrimonio:", error);
        res.redirect(`/auditoria/patrimonio?error=Error al guardar la cuenta: ${error.message}`);
    }
    });
    // Opcional: Endpoint DELETE (requiere JS con Fetch y método DELETE)
    // app.delete('/auditoria/patrimonio/:id', isAuthenticated, async (req, res) => { ... });

    // --- GET /vendedores (Modificada para Cards y Datos Agregados) ---


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
        SELECT vendedor_id, insta_username, mensajes_enviados, respuestas_recibidas, mensajes_manuales -- <<< AÑADIDO
        FROM vendedor_desempeno_diario
        WHERE fecha = $1
    `;
    const desempenoHoyResult = await pool.query(sqlQueryHoy, [hoy]);
    const desempenoHoyMap = desempenoHoyResult.rows.reduce((map, item) => {
        if (!map[item.vendedor_id]) map[item.vendedor_id] = {};
        map[item.vendedor_id][item.insta_username.toLowerCase()] = {
            mensajes: item.mensajes_enviados,
            respuestas: item.respuestas_recibidas,
            mensajesManuales: item.mensajes_manuales // <<< AÑADIDO (usar camelCase aquí es opcional, pero consistente)
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

        const vendedoresParaVista = vendedores.map(vendedor => {
            let cuentasConDatos = [];
            let totalMensajesHoy = 0;
            let totalRespuestasHoy = 0;
            let totalMensajesManualesHoy = 0; // <<< NUEVO
            let totalMensajesMongo = 0;
            if (vendedor.cuentas_asignadas?.length) { // Mejor check
            cuentasConDatos = vendedor.cuentas_asignadas.map(cuenta => {
                const cuentaLower = cuenta.toLowerCase();
                // Incluir default para mensajesManuales
                const desempenoCuentaHoy = desempenoHoyMap[vendedor.id]?.[cuentaLower] || { mensajes: 0, respuestas: 0, mensajesManuales: 0 }; // <<< AÑADIDO default
                const mensajesMongo = mongoMessageCounts[cuentaLower] || 0;
                totalMensajesHoy += desempenoCuentaHoy.mensajes;
                totalRespuestasHoy += desempenoCuentaHoy.respuestas;
                totalMensajesManualesHoy += desempenoCuentaHoy.mensajesManuales; // <<< NUEVO: Sumar
                totalMensajesMongo += mensajesMongo;
                return {
                    nombre: cuenta,
                    mensajesHoy: desempenoCuentaHoy.mensajes,
                    respuestasHoy: desempenoCuentaHoy.respuestas,
                    mensajesManualesHoy: desempenoCuentaHoy.mensajesManuales, // <<< NUEVO: Añadir al objeto cuenta
                    mensajesMongoTotal: mensajesMongo
                    };
            });
        }
    
            const objetivoMensual = vendedor.objetivo_mensual || 0;
            const mensajesEsteMes = desempenoMesMap[vendedor.id]?.mensajes || 0; // Asume que solo cuentas mensajes de bot para el objetivo
            const progresoMensualPct = objetivoMensual > 0 ? Math.min(100, Math.max(0, (mensajesEsteMes / objetivoMensual) * 100)) : 0;
    
            return {
                ...vendedor,
                num_cuentas: vendedor.num_cuentas || 0,
                cuentasDetalle: cuentasConDatos,
                totalMensajesHoy,
                totalRespuestasHoy,
                totalMensajesManualesHoy, // <<< NUEVO: Pasar a la vista
                totalMensajesMongo,
                total_mensajes_mes: mensajesEsteMes,
                progreso_mensajes_mes_pct: progresoMensualPct,
            };
    });
    
    // 7. Renderizar vista
    res.render('vendedores', {
        vendedores: vendedoresParaVista, // Ya incluye el nuevo total
        user: req.session.user,
        // ... (resto de variables: success, error, today, etc.) ...
            success: res.locals.success_msg || req.query.success, // Usar flash
            error: res.locals.error_msg || initialDashboardData.error || req.query.error, // Usar flash
            today: hoy,
            initialDashboard: initialDashboardData,
            initialStartDate: initialStartDate,
            initialEndDate: initialEndDate
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
    // --- NUEVO: POST /vendedores/desempeno (CORREGIDO para incluir mensajes_manuales) ---
    app.post('/vendedores/desempeno', isAuthenticated, async (req, res) => { // requireRole añadido por coherencia
        const { vendedor_id, fecha, desempeno } = req.body; // desempeno ahora debe incluir {cuenta, mensajes, respuestas, mensajes_manuales}

        if (!vendedor_id || !fecha || !Array.isArray(desempeno) || desempeno.length === 0) {
            return res.status(400).json({ success: false, message: 'Datos incompletos.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const item of desempeno) {
                const cuenta = item.cuenta?.trim().toLowerCase();
                const mensajes = parseInt(item.mensajes, 10) || 0;
                const respuestas = parseInt(item.respuestas, 10) || 0;
                const mensajesManuales = parseInt(item.mensajes_manuales, 10) || 0; // <<< NUEVO: Obtener mensajes manuales

                if (!cuenta) continue;

                // Query actualizada para incluir mensajes_manuales
                const queryText = `
                    INSERT INTO vendedor_desempeno_diario
                        (vendedor_id, fecha, insta_username, mensajes_enviados, respuestas_recibidas, mensajes_manuales)
                    VALUES ($1, $2, $3, $4, $5, $6) -- Añadido $6
                    ON CONFLICT (vendedor_id, fecha, insta_username) DO UPDATE SET
                        mensajes_enviados = EXCLUDED.mensajes_enviados,     -- Sobreescribir
                        respuestas_recibidas = EXCLUDED.respuestas_recibidas, -- Sobreescribir
                        mensajes_manuales = EXCLUDED.mensajes_manuales,   -- <<< NUEVO: Sobreescribir mensajes manuales
                        updated_at = CURRENT_TIMESTAMP;
                `;
                // Pasar el nuevo valor a la query
                await client.query(queryText, [vendedor_id, fecha, cuenta, mensajes, respuestas, mensajesManuales]); // Añadido mensajesManuales
            }

            await client.query('COMMIT');
            res.json({ success: true, message: 'Desempeño registrado/actualizado correctamente.' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en POST /vendedores/desempeno:", error);
            res.status(500).json({ success: false, message: `Error al registrar desempeño: ${error.message}` });
        } finally {
            client.release();
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
        // 2. Obtener historial de desempeño ordenado (AÑADIR mensajes_manuales)
        const historialResult = await pool.query(`
            SELECT fecha, insta_username, mensajes_enviados, respuestas_recibidas, mensajes_manuales -- <<< AÑADIDO
            FROM vendedor_desempeno_diario
            WHERE vendedor_id = $1
            ORDER BY fecha DESC, insta_username ASC
        `, [vendedorId]);
        const historial = historialResult.rows; // Ahora cada item tiene mensajes_manuales

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

    async function getDashboardData(startDate, endDate, selectedAccounts = []) {
        let totalMensajes = 0;
        let totalMensajesManuales = 0;
        let totalRespuestas = 0;
        let chartData = [];
        let cuentasDisponibles = [];
        let error = null;
    
        try {
        // 1. Obtener todas las cuentas disponibles
        const cuentasResult = await pool.query(`
            SELECT DISTINCT insta_username 
            FROM vendedor_desempeno_diario
            ORDER BY insta_username ASC
        `);
        cuentasDisponibles = cuentasResult.rows.map(row => row.insta_username.toLowerCase());
    
        // 2. Filtrar cuentas si se especificaron
        const cuentasAFiltrar = selectedAccounts.length > 0 
            ? selectedAccounts.map(a => a.toLowerCase())
            : cuentasDisponibles;
    
        if (cuentasAFiltrar.length > 0) {
            // 3. Obtener totales agregados
            const totalsQuery = `
            SELECT 
                SUM(mensajes_enviados) as total_mensajes,
                SUM(mensajes_manuales) as total_manuales,
                SUM(respuestas_recibidas) as total_respuestas
            FROM vendedor_desempeno_diario
            WHERE insta_username = ANY($1) AND fecha BETWEEN $2 AND $3
            `;
            const totalsResult = await pool.query(totalsQuery, [
            cuentasAFiltrar,
            startDate,
            endDate
            ]);
    
            totalMensajes = parseInt(totalsResult.rows[0].total_mensajes || 0, 10);
            totalMensajesManuales = parseInt(totalsResult.rows[0].total_manuales || 0, 10);
            totalRespuestas = parseInt(totalsResult.rows[0].total_respuestas || 0, 10);
    
            // 4. Obtener datos para el gráfico (mensajes por día)
            const chartQuery = `
            SELECT 
                fecha,
                SUM(mensajes_enviados) as cantidad
            FROM vendedor_desempeno_diario
            WHERE insta_username = ANY($1) AND fecha BETWEEN $2 AND $3
            GROUP BY fecha
            ORDER BY fecha ASC
            `;
            const chartResult = await pool.query(chartQuery, [
            cuentasAFiltrar,
            startDate,
            endDate
            ]);
    
            // 5. Procesar datos para el gráfico
            chartData = chartResult.rows.map(row => ({
            fecha: new Date(row.fecha).toISOString().split('T')[0],
            cantidad: parseInt(row.cantidad, 10)
            }));
    
            // 6. Rellenar días faltantes con cero
            const start = new Date(startDate);
            const end = new Date(endDate);
            const allDates = [];
            
            for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            allDates.push(dateStr);
            }
    
            const chartDataMap = chartData.reduce((acc, item) => {
            acc[item.fecha] = item.cantidad;
            return acc;
            }, {});
    
            chartData = allDates.map(date => ({
            fecha: date,
            cantidad: chartDataMap[date] || 0
            }));
        }
        } catch (err) {
        console.error("Error al obtener datos del dashboard:", err);
        error = err.message;
        chartData = [];
        totalMensajes = 0;
        totalMensajesManuales = 0;
        totalRespuestas = 0;
        }
    
        return { 
        totalMensajes, 
        totalMensajesManuales,
        totalRespuestas,
        chartData, 
        error,
        cuentasDisponibles
        };
    }


    // Endpoint para obtener datos de la tabla
    app.get('/crecimiento/table-data', isAuthenticated, async (req, res) => {
        const { from, to, accounts } = req.query;
    
        // Validar fechas
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
        return res.status(400).json({ error: 'Fechas inválidas o faltantes (YYYY-MM-DD)' });
        }
    
        // Procesar cuentas si se especificaron
        const selectedAccounts = accounts ? accounts.split(',') : [];
    
        try {
        // Consulta SQL para obtener datos detallados por cuenta
        const query = `
            SELECT 
            insta_username as cuenta,
            SUM(mensajes_enviados) as mensajes_automaticos,
            SUM(mensajes_manuales) as mensajes_manuales,
            SUM(respuestas_recibidas) as respuestas,
            CASE 
                WHEN SUM(mensajes_enviados) > 0 THEN 
                ROUND((SUM(respuestas_recibidas)::numeric / SUM(mensajes_enviados)) * 100, 1)
                ELSE 0 
            END as tasa_respuesta
            FROM vendedor_desempeno_diario
            WHERE fecha BETWEEN $1 AND $2
            ${selectedAccounts.length > 0 ? 'AND insta_username = ANY($3)' : ''}
            GROUP BY insta_username
            ORDER BY mensajes_automaticos DESC
        `;
    
        const queryParams = [from, to];
        if (selectedAccounts.length > 0) {
            queryParams.push(selectedAccounts);
        }
    
        const result = await pool.query(query, queryParams);
        
        res.json({
            tableData: result.rows
        });
    
        } catch (error) {
        console.error("Error en GET /crecimiento/table-data:", error);
        res.status(500).json({ error: 'Error interno al obtener datos de la tabla' });
        }
    });
    app.get('/crecimiento/dashboard-data', isAuthenticated, async (req, res) => {
        const { from, to, accounts } = req.query;
    
        // Validar fechas
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!from || !to || !dateRegex.test(from) || !dateRegex.test(to)) {
        return res.status(400).json({ error: 'Fechas inválidas o faltantes (YYYY-MM-DD)' });
        }
    
        // Procesar cuentas si se especificaron
        const selectedAccounts = accounts ? accounts.split(',') : [];
    
        try {
        const dashboardData = await getDashboardData(from, to, selectedAccounts);
        
        if (dashboardData.error) {
            return res.status(500).json({ error: dashboardData.error });
        }
    
        res.json(dashboardData);
        } catch (error) {
        console.error("Error en GET /crecimiento/dashboard-data:", error);
        res.status(500).json({ error: 'Error interno al obtener datos del dashboard' });
        }
    });
    app.get('/crecimiento', isAuthenticated, async (req, res) => {
        // Define fechas por defecto para el dashboard inicial (ej: último mes)
        const defaultEndDate = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultEndDate.getDate() - 29); // 30 días incluyendo hoy
        const initialStartDate = defaultStartDate.toISOString().slice(0, 10);
        const initialEndDate = defaultEndDate.toISOString().slice(0, 10);
    
        try {
        // 1. Obtener datos del dashboard inicial
        const initialDashboardData = await getDashboardData(initialStartDate, initialEndDate);
    
        // 2. Obtener datos de vendedores
        const sqlQueryVendedores = `
            SELECT v.*,
                COALESCE(jsonb_array_length(v.cuentas_asignadas), 0) as num_cuentas
            FROM vendedores v ORDER BY v.nombre ASC
        `;
        const vendedoresResult = await pool.query(sqlQueryVendedores);
        const vendedores = vendedoresResult.rows;
    
        // 3. Renderizar vista
        res.render('crecimiento', {
            user: req.session.user,
            success: req.query.success,
            error: initialDashboardData.error ? `Error al cargar datos del dashboard: ${initialDashboardData.error}` : req.query.error,
            initialDashboard: initialDashboardData,
            initialStartDate: initialStartDate,
            initialEndDate: initialEndDate
        });
    
        } catch (error) {
        console.error("Error en GET /crecimiento:", error);
        res.status(500).render('error', {
            message: 'Error al cargar la página de crecimiento',
            error: error,
            user: req.session.user
        });
        }
    });

    // EN TU ARCHIVO server.js

    // ... (otros requires, app, pool, isAuthenticated, etc.) ...

    app.get('/onboarding_auditoria', isAuthenticated, (req, res) => {
    const userRole = req.session.user?.role; // Usamos optional chaining por seguridad
    return res.render('onboarding_auditoria', { user: req.session.user });

    
    });


    app.get('/onboarding_full', isAuthenticated, (req, res) => {
    const userRole = req.session.user?.role; // Usamos optional chaining por seguridad
    return res.render('onboarding_fulfillment', { user: req.session.user });

    
    });


    app.get('/onboarding_ventas', isAuthenticated, (req, res) => {
    const userRole = req.session.user?.role; // Usamos optional chaining por seguridad
    return res.render('onboarding_ventas', { user: req.session.user });

    
    });

    app.get('/onboarding', isAuthenticated, (req, res) => {
        const userRole = req.session.user?.role; // Usamos optional chaining por seguridad
        
        // Primero verificamos el rol de auditoría
        if (userRole === 'auditoria') {
            return res.render('onboarding_auditoria', { user: req.session.user });
        } 
        // Luego verificamos el rol de admin (si quieres que los admin también vean auditoría)
        else if (userRole === 'admin') {
            return res.render('onboarding_admin', { user: req.session.user });
        }
        // Finalmente verificamos fulfillment
        else if (userRole === 'fulfillment') {
            return res.render('onboarding_fulfillment', { user: req.session.user });
        } 
        // Finalmente verificamos fulfillment
        else if (userRole === 'ventas') {
        return res.render('onboarding_ventas', { user: req.session.user });
    } 
        // Para cualquier otro caso (rol desconocido o no definido)
        else {
            console.warn(`Rol de usuario no manejado en /onboarding: ${userRole}`);
            return res.redirect('/login');
        }
    });
    
    // --- NUEVOS ENDPOINTS (STUBS) PARA FULFILLMENT ---
    
    // Placeholder para el Dashboard de Fulfillment (si es distinto al principal)
    app.get('/dashboard', isAuthenticated, (req, res) => {
        // Verificar rol si es necesario
        // if (req.session.user.role !== 'fulfillment') return res.redirect('/');
        // Renderizar una vista de dashboard específica para fulfillment
        res.render('dashboard_fulfillment', { user: req.session.user, message: 'Dashboard Fulfillment (Placeholder)' }); // Necesitas crear dashboard_fulfillment.ejs
    });
    
    // Placeholder para la página dedicada al Calendario (si la quieres separada)
    app.get('/calendario', isAuthenticated, (req, res) => {
        // Verificar rol
        if (req.session.user.role !== 'fulfillment') return res.redirect('/');
        // Renderizar vista de calendario
        res.render('calendario_fulfillment', { user: req.session.user, message: 'Calendario (Placeholder)' }); // Necesitas crear calendario_fulfillment.ejs
    });
    
    // Placeholder para Actividades Clientes
    app.get('/actividades-clientes', isAuthenticated, (req, res) => {
        // Verificar rol
        if (req.session.user.role !== 'fulfillment') return res.redirect('/');
        // Renderizar vista de actividades
        res.render('actividades_clientes_fulfillment', { user: req.session.user, message: 'Actividades Clientes (Placeholder)' }); // Necesitas crear actividades_clientes_fulfillment.ejs
    });
    
    
    // --- API STUBS PARA EL CALENDARIO (Fase 2) ---
    
    // GET para obtener eventos (Devuelve array vacío por ahora)
    // EN TU server.js

    // ... (otros requires, app, pool, isAuthenticated, express.json()) ...

    // --- API COMPLETA PARA CALENDARIO FULFILLMENT (SIN TRIGGER) ---

    // GET /api/calendar/events - Obtener todos los eventos del usuario logueado
    app.get('/api/calendar/events', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'fulfillment') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        const userId = req.session.user.id;

        try {
            const query = `
                SELECT
                    id, title, description, start_date AS start, end_date AS end,
                    all_day, color
                FROM fulfillment_calendar_events
                WHERE user_id = $1 ORDER BY start_date ASC;
            `;
            const { rows } = await pool.query(query, [userId]);
            console.log(`[${new Date().toISOString()}] GET /api/calendar/events - Devolviendo ${rows.length} eventos para user ${userId}`);
            res.json(rows);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error en GET /api/calendar/events for user ${userId}:`, error);
            res.status(500).json({ error: 'Error interno al obtener eventos del calendario' });
        }
    });

    // POST /api/calendar/events - Crear un nuevo evento
    app.post('/api/calendar/events', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'fulfillment') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        const userId = req.session.user.id;
        const { title, description, start, end, all_day, color } = req.body;

        if (!title || !start) {
            return res.status(400).json({ error: 'Título y Fecha Inicio son obligatorios' });
        }

        const isAllDay = typeof all_day === 'boolean' ? all_day : (!end || end.split('T')[0] === start.split('T')[0]);
        let finalEndDate = end || null;

        console.log(`[${new Date().toISOString()}] POST /api/calendar/events for user ${userId}:`, req.body);

        try {
            // created_at y updated_at toman DEFAULT CURRENT_TIMESTAMP aquí
            const query = `
                INSERT INTO fulfillment_calendar_events
                    (title, description, start_date, end_date, all_day, color, user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, title, description, start_date AS start, end_date AS end, all_day, color;
            `;
            const { rows } = await pool.query(query, [
                title, description || null, start, finalEndDate, isAllDay, color || null, userId
            ]);
            console.log(`[${new Date().toISOString()}] Evento creado con ID: ${rows[0].id}`);
            res.status(201).json({ message: 'Evento creado correctamente', event: rows[0] });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error en POST /api/calendar/events for user ${userId}:`, error);
            if (error.code === '22007' || error.code === '22008') {
                return res.status(400).json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD o formato ISO 8601.' });
            }
            res.status(500).json({ error: 'Error interno al crear el evento' });
        }
    });

    // PUT /api/calendar/events/:id - Actualizar un evento existente
    app.put('/api/calendar/events/:id', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'fulfillment') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        const eventId = req.params.id;
        const userId = req.session.user.id;
        const { title, description, start, end, all_day, color } = req.body;

        if (!eventId) {
            return res.status(400).json({ error: 'ID del evento es requerido' });
        }

        console.log(`[${new Date().toISOString()}] PUT /api/calendar/events/${eventId} for user ${userId}:`, req.body);

        try {
            const currentEventResult = await pool.query(
                'SELECT * FROM fulfillment_calendar_events WHERE id = $1 AND user_id = $2',
                [eventId, userId]
            );

            if (currentEventResult.rows.length === 0) {
                return res.status(404).json({ error: 'Evento no encontrado o no tienes permiso para editarlo.' });
            }
            const currentEvent = currentEventResult.rows[0];

            const isAllDay = typeof all_day === 'boolean' ? all_day : currentEvent.all_day;
            let finalEndDate = end !== undefined ? (end || null) : currentEvent.end_date;

            // **** ¡CAMBIO IMPORTANTE (YA ESTABA PERO AHORA ES ESENCIAL)! ****
            // Actualizamos updated_at explícitamente a la hora actual.
            const query = `
                UPDATE fulfillment_calendar_events SET
                    title = COALESCE($1, title),           -- Usa nuevo valor o mantiene el actual
                    description = COALESCE($2, description),
                    start_date = COALESCE($3, start_date),
                    end_date = $4,                         -- Usa finalEndDate (puede ser null)
                    all_day = COALESCE($5, all_day),
                    color = COALESCE($6, color),
                    updated_at = CURRENT_TIMESTAMP         -- <-- ACTUALIZACIÓN MANUAL
                WHERE id = $7 AND user_id = $8
                RETURNING id, title, description, start_date AS start, end_date AS end, all_day, color;
            `;
            // Pasamos los valores recibidos o undefined para que COALESCE funcione
            const { rows } = await pool.query(query, [
                title, // COALESCE($1, title) tomará este si no es null/undefined
                description, // COALESCE($2, description) tomará este si no es null/undefined
                start, // COALESCE($3, start_date) tomará este si no es null/undefined
                finalEndDate, // El $4 es finalEndDate directamente
                isAllDay, // COALESCE($5, all_day) tomará este si no es null/undefined
                color, // COALESCE($6, color) tomará este si no es null/undefined
                eventId,
                userId
            ]);
            // Nota sobre COALESCE: Si envías explícitamente `null` en el body, COALESCE usará `null`.
            // Si *no envías* el campo en el body (es `undefined`), COALESCE usará el valor actual de la BD.

            if (rows.length === 0) {
                console.warn(`[${new Date().toISOString()}] PUT /api/calendar/events/${eventId} - Update failed after initial check for user ${userId}`);
                return res.status(404).json({ error: 'No se pudo actualizar el evento.' });
            }

            console.log(`[${new Date().toISOString()}] Evento ${eventId} actualizado.`);
            res.status(200).json({ message: 'Evento actualizado correctamente', event: rows[0] });

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error en PUT /api/calendar/events/${eventId} for user ${userId}:`, error);
            if (error.code === '22007' || error.code === '22008') {
                return res.status(400).json({ error: 'Formato de fecha inválido.' });
            }
            res.status(500).json({ error: 'Error interno al actualizar el evento' });
        }
    });

    // DELETE /api/calendar/events/:id - Borrar un evento
    app.delete('/api/calendar/events/:id', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'fulfillment') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        const eventId = req.params.id;
        const userId = req.session.user.id;

        if (!eventId) {
            return res.status(400).json({ error: 'ID del evento es requerido' });
        }

        console.log(`[${new Date().toISOString()}] DELETE /api/calendar/events/${eventId} for user ${userId}`);

        try {
            const query = `DELETE FROM fulfillment_calendar_events WHERE id = $1 AND user_id = $2 RETURNING id;`;
            const result = await pool.query(query, [eventId, userId]);

            if (result.rowCount === 0) {
                console.warn(`[${new Date().toISOString()}] DELETE /api/calendar/events/${eventId} - Event not found or permission denied for user ${userId}`);
                return res.status(404).json({ error: 'Evento no encontrado o no tienes permiso para borrarlo.' });
            }

            console.log(`[${new Date().toISOString()}] Evento ${eventId} borrado.`);
            res.status(200).json({ message: 'Evento borrado correctamente', deletedEventId: eventId });

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error en DELETE /api/calendar/events/${eventId} for user ${userId}:`, error);
            res.status(500).json({ error: 'Error interno al borrar el evento' });
        }
    });

    // ... (resto de tus rutas, incluida la GET /onboarding modificada) ...
    
    // TODO Fase 2: Añadir endpoints PUT /api/calendar/events/:id y DELETE /api/calendar/events/:id
    
    // ... (resto de tus rutas existentes y app.listen) ...
    

    // --- Rutas de Auditoría - Trackeo ---

    // GET /auditoria/trackeo - Muestra el formulario y el historial
    // GET /auditoria/trackeo - Muestra AMBOS (Uploads y Manuales)
    app.get('/auditoria/trackeo', isAuthenticated, async (req, res, next) => {
        console.log("[Trackeo] Accediendo a la vista combinada.");
        try {
            // 1. Obtener historial de uploads CSV
            const uploadQuery = `
                SELECT t.*, u.username as uploaded_by_username
                FROM tracking_uploads t
                LEFT JOIN users u ON t.uploaded_by_user_id = u.id
                ORDER BY t.uploaded_at DESC;
            `;
            const uploadResult = await pool.query(uploadQuery);
            const uploads = uploadResult.rows;
    
            // 2. Obtener historial de seguimientos manuales
            const manualQuery = `
                SELECT m.*, u.username as added_by_username
                FROM manual_niche_tracking m
                LEFT JOIN users u ON m.added_by_user_id = u.id
                ORDER BY m.created_at DESC;
            `;
            const manualResult = await pool.query(manualQuery);
            const manualNiches = manualResult.rows;
    
            // 3. Obtener cuentas del patrimonio
            const cuentasQuery = `
                SELECT usuario 
                FROM patrimonio_cuentas
                ORDER BY usuario ASC;
            `;
            const cuentasResult = await pool.query(cuentasQuery);
            const cuentas = cuentasResult.rows.map(row => row.usuario);
    
            console.log(`[Trackeo] Encontrados ${uploads.length} uploads, ${manualNiches.length} seguimientos manuales y ${cuentas.length} cuentas.`);
    
            res.render('auditoria_trackeo', {
                user: req.session.user,
                uploads: uploads,
                manualNiches: manualNiches,
                cuentas: cuentas,  // <<< Nuevo dato
                success: res.locals.success_msg,
                error: res.locals.error_msg
            });
    
        } catch (error) {
            console.error("[Trackeo] Error en GET /auditoria/trackeo:", error);
            next(error);
        }
    });

    // POST /auditoria/trackeo - Maneja la subida del archivo CSV
    app.post('/auditoria/trackeo', isAuthenticated, upload.single('csvFile'), async (req, res) => {
    // Verificar Rol (opcional)
    const userRole = req.session.user.role;
    if (userRole !== 'admin' && userRole !== 'auditoria') {
        // Si multer ya guardó el archivo, deberíamos borrarlo
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).redirect('/auditoria/trackeo?error=Acción no permitida');
    }


    // --- NUEVA RUTA: POST para Guardar Seguimiento Manual ---


    // Verificar si Multer encontró un error (ej. tipo de archivo incorrecto)
    if (!req.file) {
        // Si no hay req.file, puede ser porque el filtro lo rechazó o no se envió archivo
        return res.redirect('/auditoria/trackeo?error=' + (req.multerError || 'No se subió ningún archivo o el tipo no es CSV.'));
    }

    const { tipo_nicho } = req.body;
    const userId = req.session.user.id;

    if (!tipo_nicho) {
        // Borrar el archivo subido si falta el tipo de nicho
        fs.unlinkSync(req.file.path);
        return res.redirect('/auditoria/trackeo?error=El Tipo de Nicho es obligatorio.');
    }

    try {
        const { originalname, filename: saved_filename, path: filepath, mimetype, size } = req.file;

        const insertQuery = `
            INSERT INTO tracking_uploads
                (original_filename, saved_filename, filepath, mimetype, size, tipo_nicho, uploaded_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        await pool.query(insertQuery, [
            originalname, saved_filename, filepath, mimetype, size, tipo_nicho.trim(), userId
        ]);

        res.redirect('/auditoria/trackeo?success=Archivo subido y registrado correctamente.');

    } catch (dbError) {
        console.error("Error al guardar registro en BD:", dbError);
        // Intentar borrar el archivo físico si falló la inserción en BD
        try {
            fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
            console.error("Error al borrar archivo después de fallo de BD:", unlinkErr);
            // Considerar loggear esto de forma más robusta
        }
        res.redirect('/auditoria/trackeo?error=Error al guardar la información en la base de datos.');
    }
    });

    app.post('/auditoria/manual-tracking', isAuthenticated, async (req, res) => {
    const { cuenta_a_trackear, cuenta_a_usar, tipo_palabra_clave, notas_manual } = req.body;
    const userId = req.session.user.id;
    if (!cuenta_a_trackear || !cuenta_a_usar || !tipo_palabra_clave) { req.session.error_msg = 'Campos Cuenta Trackear, Cuenta Usar y Tipo son obligatorios.'; return res.redirect('/auditoria/trackeo'); }
    console.log(`[Trackeo Manual] Creando entrada por user ${userId}:`, req.body);
    try {
        const query = `INSERT INTO manual_niche_tracking (cuenta_a_trackear, cuenta_a_usar, tipo_palabra_clave, notas, added_by_user_id, estado) VALUES ($1, $2, $3, $4, $5, 'activo') RETURNING id;`;
        await pool.query(query, [cuenta_a_trackear.trim(), cuenta_a_usar.trim(), tipo_palabra_clave.trim(), notas_manual || null, userId]);
        req.session.success_msg = 'Seguimiento manual agregado.';
        res.redirect('/auditoria/trackeo');
    } catch (error) { console.error("[Trackeo Manual] Error POST:", error); req.session.error_msg = `Error al guardar: ${error.message}`; res.redirect('/auditoria/trackeo'); }
    });

    // GET /auditoria/trackeo/download/:id - Permite descargar un archivo específico
    app.get('/auditoria/trackeo/download/:id', isAuthenticated, async (req, res) => {
    // Puedes añadir verificación de rol si solo ciertos usuarios pueden descargar
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT filepath, original_filename FROM tracking_uploads WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).send('Archivo no encontrado.');
        }

        const fileInfo = result.rows[0];
        const filePath = path.resolve(fileInfo.filepath); // Usar path.resolve por seguridad

        // Verificar que el archivo exista en el servidor antes de intentar descargarlo
        if (!fs.existsSync(filePath)) {
            console.error(`Error: Archivo no encontrado en el sistema de archivos: ${filePath} (Registro ID: ${id})`);
            // Opcional: Marcar este registro en la BD como 'no encontrado' o 'inválido'
            return res.status(404).send('Error: El archivo asociado a este registro no se encuentra en el servidor.');
        }

        // res.download() maneja los headers Content-Disposition y Content-Type
        res.download(filePath, fileInfo.original_filename, (err) => {
            if (err) {
                // Manejo de errores específicos de res.download
                console.error(`Error al intentar descargar ${filePath}:`, err);
                if (!res.headersSent) {
                    // Si aún no se han enviado headers, podemos enviar un error 500
                    res.status(500).send('Error al procesar la descarga del archivo.');
                }
                // Si los headers ya se enviaron, el error es más difícil de manejar limpiamente.
                // Node.js podría cerrar la conexión. El log es importante aquí.
            }
        });

    } catch (error) {
        console.error("Error en GET /auditoria/trackeo/download/:id:", error);
        res.status(500).send('Error interno del servidor al intentar descargar el archivo.');
    }
    });


    // Middleware para manejar errores específicos de Multer (como tamaño de archivo excedido)
    // Debe ir DESPUÉS de las rutas que usan `upload`
    app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
    // Un error de Multer ocurrió (ej. límite de tamaño)
    console.error("MulterError:", err);
    // Redirige a la página anterior (si es posible) o a la página de trackeo con un mensaje de error
    const redirectUrl = req.headers.referer || '/auditoria/trackeo';
    return res.redirect(`${redirectUrl}?error=Error al subir archivo: ${err.message}`);
    } else if (err) {
    // Otro tipo de error (ej. filtro de archivo)
    console.error("File Upload Error:", err);
    const redirectUrl = req.headers.referer || '/auditoria/trackeo';
    return res.redirect(`${redirectUrl}?error=${err.message || 'Error desconocido al subir el archivo.'}`);
    }
    // Si no es un error de subida, pasa al siguiente middleware de errores
    next(err);
    });

    // ... resto de tus rutas y app.listen ...


    // =============================================
    //           server.js (Añadir esta sección)
    // =============================================

    // ... (Dependencias, Configuración, Middlewares, Rutas Públicas, Onboarding, Fulfillment, Auditoría, Vendedores... todo lo anterior) ...


// =============================================
//           NUEVAS RUTAS PARA CLOSERS
// =============================================

// --- GET /closers (Vista Principal) ---
app.get('/closers', isAuthenticated, async (req, res, next) => {
    console.log(`[Closers] Accediendo a la vista.`);
    const hoy = new Date().toISOString().slice(0,10); // Fecha de hoy

    try {
        // 1. Obtener todos los closers ordenados
        const closersQuery = `
            SELECT c.* -- Selecciona todas las columnas de closers
            FROM closers c
            ORDER BY c.nombre ASC;
        `;
        const closersResult = await pool.query(closersQuery);
        const closers = closersResult.rows;
        const closerIds = closers.map(c => c.id);

        // 2. Obtener agendas de HOY para cada closer (si hay closers)
        let agendasHoyMap = {};
        if (closerIds.length > 0) {
            const agendasHoyQuery = `
                SELECT closer_id, agendas_registradas, notas
                FROM closer_agendas_diarias
                WHERE fecha = $1 AND closer_id = ANY($2::int[]);
            `;
            const agendasHoyResult = await pool.query(agendasHoyQuery, [hoy, closerIds]);
            agendasHoyResult.rows.forEach(item => {
                agendasHoyMap[item.closer_id] = {
                    agendas: item.agendas_registradas || 0,
                    notas: item.notas
                };
            });
        }

        // 3. Calcular agendas del MES ACTUAL para cada closer (si hay closers)
        const nowForMonth = new Date();
        const year = nowForMonth.getFullYear();
        const month = nowForMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).toISOString().slice(0, 10);
        const lastDayOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        let agendasMesMap = {};
        if (closerIds.length > 0) {
            const agendasMesQuery = `
                SELECT closer_id, SUM(agendas_registradas) as total_agendas_mes
                FROM closer_agendas_diarias
                WHERE closer_id = ANY($1::int[]) AND fecha >= $2 AND fecha <= $3
                GROUP BY closer_id;
            `;
            const agendasMesResult = await pool.query(agendasMesQuery, [closerIds, firstDayOfMonth, lastDayOfMonth]);
            agendasMesResult.rows.forEach(item => {
                agendasMesMap[item.closer_id] = parseInt(item.total_agendas_mes, 10) || 0;
            });
        }

        // 4. Combinar datos para la vista
        const closersParaVista = closers.map(closer => {
            const objetivoAgendas = closer.objetivo_mensual || 0; // Usar objetivo_mensual si es para agendas
            const agendasEsteMes = agendasMesMap[closer.id] || 0;
            const progresoAgendasPct = objetivoAgendas > 0 ? Math.min(100, Math.max(0, (agendasEsteMes / objetivoAgendas) * 100)) : 0;

            return {
                ...closer,
                agendasHoy: agendasHoyMap[closer.id]?.agendas || 0,
                notasHoy: agendasHoyMap[closer.id]?.notas || null,
                agendasEsteMes: agendasEsteMes,
                progresoAgendasPct: progresoAgendasPct,
                num_cuentas: closer.cuentas_asignadas?.length || 0 // Calcula basado en el array
            };
        });

        // 5. Renderizar vista
        res.render('closers', {
            user: req.session.user,
            closers: closersParaVista,
            today: hoy,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error("[Closers] Error en GET /closers:", error);
        next(error);
    }
});

// --- POST /closers (Crear/Editar Closer) ---
app.post('/closers', isAuthenticated, async (req, res) => {
    const userRole = req.session.user.role;
     if (userRole !== 'ventas' && userRole !== 'auditoria') { // Solo roles permitidos
         req.session.error_msg = 'Acción no permitida.';
         return res.redirect('/closers');
     }

    const { closer_id, nombre, cuentas_asignadas, estado, objetivo_mensual, manager_asignado, fecha_ingreso, notas_auditoria } = req.body;

    if (!nombre) { req.session.error_msg = 'El nombre es obligatorio'; return res.redirect('/closers'); }

    let cuentasArray = [];
    if (cuentas_asignadas && typeof cuentas_asignadas === 'string') {
        cuentasArray = cuentas_asignadas.split(',').map(c => c.trim()).filter(Boolean);
    }
    const cuentasJson = JSON.stringify(cuentasArray);
    const objetivo = parseInt(objetivo_mensual, 10) || 0;
    const ingreso = fecha_ingreso || null;

    try {
        if (closer_id) { // --- MODO EDICIÓN ---
            console.log(`[Closers] Actualizando Closer ID: ${closer_id}`);
            const queryText = `
                UPDATE closers SET
                    nombre = $1, cuentas_asignadas = $2, estado = $3, objetivo_mensual = $4,
                    manager_asignado = $5, fecha_ingreso = $6, notas_auditoria = $7,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $8;
            `;
            await pool.query(queryText, [
                nombre, cuentasJson, estado || 'activo', objetivo, manager_asignado || null, ingreso, notas_auditoria || null, closer_id
            ]);
            req.session.success_msg = 'Closer actualizado correctamente.';

        } else { // --- MODO AGREGAR ---
             console.log(`[Closers] Creando nuevo Closer: ${nombre}`);
             const queryText = `
                INSERT INTO closers (nombre, cuentas_asignadas, estado, objetivo_mensual, manager_asignado, fecha_ingreso, notas_auditoria)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
            `;
            await pool.query(queryText, [
                 nombre, cuentasJson, estado || 'activo', objetivo, manager_asignado || null, ingreso, notas_auditoria || null
            ]);
            req.session.success_msg = 'Closer agregado correctamente.';
        }
        res.redirect('/closers');

    } catch (error) {
        console.error("[Closers] Error en POST /closers:", error);
        req.session.error_msg = `Error al guardar closer: ${error.message}`;
        res.redirect('/closers');
    }
});

// --- POST /closers/agendas (Registrar Agendas Diarias) ---
app.post('/closers/agendas', isAuthenticated, async (req, res) => {
    const userRole = req.session.user.role;
     if (userRole !== 'ventas' && userRole !== 'auditoria') { // O el rol que pueda registrar
         return res.status(403).json({ success: false, message: 'Acción no permitida.' });
     }

    const { closer_id, fecha, agendas_registradas, notas } = req.body;

    if (!closer_id || !fecha) {
        return res.status(400).json({ success: false, message: 'ID del Closer y Fecha son requeridos.' });
    }

    const agendas = parseInt(agendas_registradas, 10);
     if (isNaN(agendas) || agendas < 0) {
         return res.status(400).json({ success: false, message: 'Número de agendas inválido.' });
     }

    console.log(`[Closers] Registrando agendas para Closer ID: ${closer_id}, Fecha: ${fecha}`);

    try {
        const queryText = `
            INSERT INTO closer_agendas_diarias
                (closer_id, fecha, agendas_registradas, notas)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (closer_id, fecha) DO UPDATE SET
                agendas_registradas = EXCLUDED.agendas_registradas,
                notas = EXCLUDED.notas,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await pool.query(queryText, [closer_id, fecha, agendas, notas || null]);

        res.json({ success: true, message: 'Agendas registradas/actualizadas correctamente.' });

    } catch (error) {
        console.error("[Closers] Error en POST /closers/agendas:", error);
        res.status(500).json({ success: false, message: `Error al registrar agendas: ${error.message}` });
    }
});

// --- GET /closers/:id/historial ---
app.get('/closers/:id/historial', isAuthenticated, async (req, res, next) => {
    const closerId = req.params.id;
    console.log(`[Closers] Accediendo historial para Closer ID: ${closerId}`);

    try {
        // 1. Obtener datos del closer
        const closerResult = await pool.query('SELECT * FROM closers WHERE id = $1', [closerId]);
        if (closerResult.rows.length === 0) {
            return res.status(404).render('error', {message: 'Closer no encontrado', error: {}, user: req.session.user});
        }
        const closer = closerResult.rows[0];

        // 2. Obtener historial de agendas diarias ordenado
        const historialResult = await pool.query(`
            SELECT fecha, agendas_registradas, notas
            FROM closer_agendas_diarias
            WHERE closer_id = $1
            ORDER BY fecha DESC
        `, [closerId]);
        const historial = historialResult.rows;
        console.log(`[Closers] Encontrados ${historial.length} registros de historial para Closer ID: ${closerId}`);

        // 3. Agrupar por fecha para la vista (opcional, pero bueno para UI)
        const historialAgrupado = historial.reduce((acc, item) => {
            const fechaStr = item.fecha.toISOString().slice(0, 10);
            if (!acc[fechaStr]) {
                acc[fechaStr] = { fecha: fechaStr, entradas: [] };
            }
            // Solo añadimos la entrada del día (ya que solo hay una por día)
            acc[fechaStr].entradas.push({
                agendas: item.agendas_registradas,
                notas: item.notas
            });
            return acc;
        }, {});

        res.render('closer_historial', { // Renderizar la NUEVA vista closer_historial.ejs
            closer: closer,
            historial: Object.values(historialAgrupado).sort((a, b) => b.fecha.localeCompare(a.fecha)), // Ordena grupos por fecha
            user: req.session.user
        });

    } catch (error) {
        console.error(`[Closers] Error en GET /closers/${closerId}/historial:`, error);
        next(error);
    }
});

// DELETE /closers/:id (Si necesitas borrar closers)
app.delete('/closers/:id', isAuthenticated, async (req, res) => {
     const userRole = req.session.user.role;
     if (userRole !== 'admin' && userRole !== 'auditoria') {
         return res.status(403).json({ success: false, message: 'Acción no permitida.' });
     }
    const { id } = req.params;
    console.log(`[Closers] Intento de borrado ID: ${id}`);
    try {
        // Borrar primero dependencias (historial diario)
        await pool.query('DELETE FROM closer_agendas_diarias WHERE closer_id = $1', [id]);
        // Luego borrar el closer
        const result = await pool.query('DELETE FROM closers WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Closer no encontrado.' });
        }
        console.log(`[Closers] Closer ID: ${id} y su historial borrado.`);
        res.status(200).json({ success: true, message: 'Closer y su historial eliminados correctamente.' });
    } catch (error) {
        console.error(`[Closers] Error en DELETE /closers/${id}:`, error);
        res.status(500).json({ success: false, message: `Error interno al eliminar closer: ${error.message}` });
    }
});

// =============================================
//         FIN DE NUEVAS RUTAS PARA CLOSERS
// =============================================

// ... (El resto de tus rutas existentes y app.listen) ...

    app.put('/api/manual-tracking/:id/estado', isAuthenticated,  async (req, res, next) => {
    const { id } = req.params;
    const { estado } = req.body;
    const userId = req.session.user.id; // Para auditoría

    const validStates = ['activo', 'pausado', 'finalizado']; // Estados permitidos
    if (!estado || !validStates.includes(estado)) {
        return res.status(400).json({ success: false, message: 'Estado inválido o faltante.' });
    }

    console.log(`[API Trackeo Manual] Actualizando estado de ID ${id} a '${estado}' por user ${userId}`);
    try {
        const query = `
            UPDATE manual_niche_tracking
            SET estado = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, estado;
        `;
        const result = await pool.query(query, [estado, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrada no encontrada.' });
        }

        res.json({ success: true, message: 'Estado actualizado.', updated: result.rows[0] });
    } catch (error) {
        console.error(`[API Trackeo Manual] Error PUT estado ID ${id}:`, error);
        next(error); // Pasar al manejador general
    }
    });

    // DELETE /api/auditoria/trackeo/uploads/:id - Borrar registro CSV y archivo físico
    app.delete('/api/auditoria/trackeo/uploads/:id', isAuthenticated,  async (req, res, next) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    console.log(`[Trackeo CSV Delete] Solicitud para borrar ID ${id} por user ${userId}`);

    let filePathToDelete = null;
    try {
        // 1. Obtener la ruta del archivo ANTES de borrar el registro
        const findQuery = 'SELECT filepath FROM tracking_uploads WHERE id = $1';
        const findResult = await pool.query(findQuery, [id]);

        if (findResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Registro de upload no encontrado.' });
        }
        filePathToDelete = findResult.rows[0].filepath;

        // 2. Borrar el registro de la base de datos
        const deleteQuery = 'DELETE FROM tracking_uploads WHERE id = $1 RETURNING id';
        const deleteResult = await pool.query(deleteQuery, [id]);

        if (deleteResult.rowCount > 0) {
            console.log(`[Trackeo CSV Delete] Registro BD ID ${id} eliminado.`);
            // 3. Si el registro se borró, intentar borrar el archivo físico
            if (filePathToDelete) {
                const absolutePath = path.resolve(filePathToDelete); // Asegurar ruta absoluta
                console.log(`[Trackeo CSV Delete] Intentando borrar archivo: ${absolutePath}`);
                try {
                    await fs.promises.unlink(absolutePath); // Usar versión promesa de unlink
                    console.log(`[Trackeo CSV Delete] Archivo ${absolutePath} borrado exitosamente.`);
                    res.status(200).json({ success: true, message: 'Registro y archivo CSV eliminados.' });
                } catch (fileError) {
                    // Error al borrar archivo: Loggear pero devolver éxito porque el registro BD se borró
                    console.error(`[Trackeo CSV Delete] Error al borrar archivo ${absolutePath} (registro ${id} ya eliminado de BD):`, fileError);
                    res.status(200).json({ success: true, message: 'Registro eliminado, pero hubo un error al borrar el archivo físico.', fileError: fileError.code });
                }
            } else {
                console.warn(`[Trackeo CSV Delete] Registro ${id} borrado, pero no se encontró filepath.`);
                res.status(200).json({ success: true, message: 'Registro eliminado (no se encontró ruta de archivo).' });
            }
        } else {
            // Esto no debería pasar si el find inicial funcionó
            console.warn(`[Trackeo CSV Delete] Registro ${id} no encontrado para eliminar después de encontrarlo inicialmente.`);
            res.status(404).json({ success: false, message: 'Registro no encontrado para eliminar.' });
        }

    } catch (error) {
        console.error(`[Trackeo CSV Delete] Error general al borrar ID ${id}:`, error);
        next(error);
    }
    });

    // POST /api/manual-tracking/bulk - Agregar múltiples entradas manuales desde textarea
    app.post('/api/manual-tracking/bulk', isAuthenticated,  async (req, res, next) => {
    const { bulkData } = req.body; // Espera un string con líneas: trackear,usar,tipo
    const userId = req.session.user.id;

    if (!bulkData || typeof bulkData !== 'string' || bulkData.trim() === '') {
        return res.status(400).json({ success: false, message: 'No se proporcionaron datos para agregar.' });
    }

    const lines = bulkData.trim().split('\n');
    const entries = [];
    const errors = [];

    lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            entries.push({
                cuenta_a_trackear: parts[0],
                cuenta_a_usar: parts[1],
                tipo_palabra_clave: parts[2],
                added_by_user_id: userId,
                estado: 'activo' // Estado por defecto
            });
        } else {
            errors.push(`Línea ${index + 1} inválida: "${line}". Formato esperado: cuenta_a_trackear, cuenta_a_usar, tipo/palabra`);
        }
    });

    if (entries.length === 0) {
        return res.status(400).json({ success: false, message: 'Ninguna línea válida encontrada.', errors });
    }

    console.log(`[Trackeo Manual Bulk] Intentando insertar ${entries.length} entradas por user ${userId}`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let insertedCount = 0;
        // Usar un bucle para insertar una por una (más simple que construir un INSERT múltiple complejo)
        for (const entry of entries) {
            const query = `
                INSERT INTO manual_niche_tracking
                    (cuenta_a_trackear, cuenta_a_usar, tipo_palabra_clave, added_by_user_id, estado, updated_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING; -- Opcional: evitar duplicados exactos si tienes constraints
            `;
            // No incluimos 'notas' en la inserción masiva por simplicidad
            const result = await client.query(query, [
                entry.cuenta_a_trackear, entry.cuenta_a_usar, entry.tipo_palabra_clave,
                entry.added_by_user_id, entry.estado
            ]);
            insertedCount += result.rowCount; // Contar cuántas se insertaron realmente
        }
        await client.query('COMMIT');
        console.log(`[Trackeo Manual Bulk] ${insertedCount} de ${entries.length} entradas insertadas.`);
        req.session.success_msg = `${insertedCount} seguimiento(s) manual(es) agregado(s) correctamente.`;
        // Devolver éxito incluso si hubo errores de formato, pero incluir los errores
        res.status(errors.length > 0 ? 207 : 201).json({ // 207 Multi-Status si hubo errores
            success: true,
            message: `${insertedCount} entrada(s) agregada(s).`,
            errors: errors.length > 0 ? errors : null
        });

    } catch (dbError) {
        await client.query('ROLLBACK');
        console.error("[Trackeo Manual Bulk] Error BD:", dbError);
        // Devolver un error 500 genérico
        res.status(500).json({ success: false, message: 'Error interno al guardar las entradas.', errors });
        // NO usar req.session aquí porque es una API AJAX
    } finally {
        client.release();
    }
    });

    // GET /vendedores/desempeno - Dashboard de desempeño
    // GET /vendedores/desempeno - Dashboard de desempeño
    app.get('/vendedores/desempeno', isAuthenticated, async (req, res) => {
    // Fechas por defecto (últimos 30 días)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultEndDate.getDate() - 30);
    
    const initialStartDate = req.query.start_date || defaultStartDate.toISOString().split('T')[0];
    const initialEndDate = req.query.end_date || defaultEndDate.toISOString().split('T')[0];
    const selectedUsername = req.query.username || '';
    const selectedVendedor = req.query.vendedor || '';

    try {
        // 1. Obtener todos los usuarios únicos para el dropdown
        const usersQuery = `
            SELECT DISTINCT insta_username 
            FROM vendedor_desempeno_diario 
            ORDER BY insta_username ASC
        `;
        const usersResult = await pool.query(usersQuery);
        const usernames = usersResult.rows.map(row => row.insta_username);

        // 2. Obtener todos los vendedores para el dropdown
        const vendedoresQuery = `
            SELECT id, nombre FROM vendedores ORDER BY nombre ASC
        `;
        const vendedoresResult = await pool.query(vendedoresQuery);
        const vendedores = vendedoresResult.rows;

        // 3. Obtener datos para el gráfico (agrupado por fecha)
        let chartQuery = `
            SELECT 
                fecha,
                SUM(mensajes_enviados) as total_mensajes,
                SUM(mensajes_manuales) as total_manuales,
                SUM(respuestas_recibidas) as total_respuestas
            FROM vendedor_desempeno_diario
            WHERE fecha BETWEEN $1 AND $2
        `;
        
        let queryParams = [initialStartDate, initialEndDate];
        let paramCount = 2;
        
        if (selectedUsername) {
            paramCount++;
            chartQuery += ` AND insta_username = $${paramCount}`;
            queryParams.push(selectedUsername);
        }
        
        if (selectedVendedor) {
            paramCount++;
            chartQuery += ` AND vendedor_id = $${paramCount}`;
            queryParams.push(selectedVendedor);
        }
        
        chartQuery += ' GROUP BY fecha ORDER BY fecha ASC';
        
        const chartResult = await pool.query(chartQuery, queryParams);
        
        // 4. Obtener datos para la tabla (detallado por usuario)
        let tableQuery = `
            SELECT 
                v.id as vendedor_id,
                v.nombre as vendedor,
                d.insta_username,
                d.fecha,
                d.mensajes_enviados,
                d.mensajes_manuales,
                d.respuestas_recibidas,
                CASE 
                    WHEN d.mensajes_enviados > 0 THEN 
                        ROUND((d.respuestas_recibidas::numeric / d.mensajes_enviados) * 100, 1)
                    ELSE 0 
                END as tasa_respuesta
            FROM vendedor_desempeno_diario d
            LEFT JOIN vendedores v ON d.vendedor_id = v.id
            WHERE d.fecha BETWEEN $1 AND $2
        `;
        
        paramCount = 2;
        
        if (selectedUsername) {
            paramCount++;
            tableQuery += ' AND d.insta_username = $' + paramCount;
        }
        
        if (selectedVendedor) {
            paramCount++;
            tableQuery += ' AND d.vendedor_id = $' + paramCount;
        }
        
        tableQuery += ' ORDER BY d.fecha DESC, v.nombre ASC';
        
        const tableResult = await pool.query(tableQuery, queryParams);
        
        // 5. Calcular totales
        const totals = {
            mensajes: 0,
            manuales: 0,
            respuestas: 0
        };
        
        chartResult.rows.forEach(row => {
            totals.mensajes += parseInt(row.total_mensajes || 0, 10);
            totals.manuales += parseInt(row.total_manuales || 0, 10);
            totals.respuestas += parseInt(row.total_respuestas || 0, 10);
        });

        res.render('desempeno_vendedores', {
            user: req.session.user,
            usernames,
            vendedores,
            selectedUsername,
            selectedVendedor,
            startDate: initialStartDate,
            endDate: initialEndDate,
            chartData: JSON.stringify(chartResult.rows), // Enviar como JSON para el JS
            tableData: tableResult.rows,
            totals,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error("Error en GET /vendedores/desempeno:", error);
        res.status(500).render('error', {
            message: 'Error al cargar el dashboard de desempeño',
            error: error,
            user: req.session.user
        });
    }
    });



    // --- RUTAS PARA SPRINTS ---

    // GET /sprints - Vista principal de sprints
    // --- SPRINTS MODIFICADOS ---

    // POST /sprints - Crear nuevo sprint (solo admin)
    app.post('/sprints', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'admin') {
        return res.status(403).redirect('/sprints?error=Acceso no autorizado');
        }
    
        const { nombre, fecha_inicio, fecha_fin, descripcion, asignado_a } = req.body;
        
        if (!nombre || !fecha_inicio || !fecha_fin || !asignado_a) {
        return res.redirect('/sprints?error=Nombre, fechas y asignación son obligatorios');
        }
    
        try {
        const query = `
            INSERT INTO sprints (nombre, fecha_inicio, fecha_fin, descripcion, created_by, asignado_a)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        await pool.query(query, [
            nombre.trim(),
            fecha_inicio,
            fecha_fin,
            descripcion || null,
            req.session.user.id,
            asignado_a
        ]);
    
        res.redirect('/sprints?success=Sprint creado y asignado correctamente');
        } catch (error) {
        console.error("Error en POST /sprints:", error);
        res.redirect('/sprints?error=Error al crear el sprint');
        }
    });
    
    // POST /sprints/:id/cerrar - Cerrar sprint con porcentaje (solo admin)
    // --- POST /sprints/:id/cerrar - Cerrar sprint con porcentaje (solo admin) ---
    app.post('/sprints/:id/cerrar', isAuthenticated, async (req, res) => {
        if (req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acceso no autorizado' });
        }

        const { id } = req.params;
        const { porcentaje_cumplimiento, comentarios_cierre } = req.body;
        
        // Validación del porcentaje
        const porcentaje = parseInt(porcentaje_cumplimiento, 10);
        if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
            return res.status(400).json({ 
                success: false, 
                error: 'Porcentaje inválido. Debe ser un número entre 0 y 100' 
            });
        }

        try {
            const query = `
                UPDATE sprints SET
                    porcentaje_cumplimiento = $1,
                    cerrado = TRUE,
                    descripcion = COALESCE($2, descripcion),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING id
            `;
            const result = await pool.query(query, [
                porcentaje,
                comentarios_cierre || null,
                id
            ]);

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, error: 'Sprint no encontrado' });
            }

            res.json({ 
                success: true,
                message: 'Sprint cerrado correctamente',
                sprintId: id
            });
        } catch (error) {
            console.error("Error en POST /sprints/:id/cerrar:", error);
            res.status(500).json({ 
                success: false, 
                error: 'Error interno al cerrar el sprint' 
            });
        }
    });
    
    // --- DEVOLUCIONES MODIFICADAS ---
    
    // GET /sprints - Vista principal modificada
    // --- GET /sprints - Vista principal con filtros ---
    app.get('/sprints', isAuthenticated, async (req, res) => {
        try {
            // Obtener parámetros de filtro
            const { titulo, fecha_inicio, fecha_fin, asignado_a } = req.query;
            
            // Construir consulta base
            let sprintsQuery;
            let queryParams = [];
            let whereClauses = [];
            
            // Filtro por rol (no admin solo ve sus sprints asignados)
            if (req.session.user.role !== 'admin') {
                whereClauses.push(`s.asignado_a = $${queryParams.length + 1}`);
                queryParams.push(req.session.user.id);
            }
            
            // Aplicar filtros
            if (titulo) {
                whereClauses.push(`s.nombre ILIKE $${queryParams.length + 1}`);
                queryParams.push(`%${titulo}%`);
            }
            
            if (fecha_inicio) {
                whereClauses.push(`s.fecha_inicio >= $${queryParams.length + 1}`);
                queryParams.push(fecha_inicio);
            }
            
            if (fecha_fin) {
                whereClauses.push(`s.fecha_fin <= $${queryParams.length + 1}`);
                queryParams.push(fecha_fin);
            }
            
            if (asignado_a && req.session.user.role === 'admin') {
                whereClauses.push(`s.asignado_a = $${queryParams.length + 1}`);
                queryParams.push(asignado_a);
            }
            
            // Construir consulta final
            sprintsQuery = `
                SELECT s.*, u.username as created_by_username, ua.username as asignado_a_username
                FROM sprints s
                LEFT JOIN users u ON s.created_by = u.id
                LEFT JOIN users ua ON s.asignado_a = ua.id
                ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
                ORDER BY s.fecha_inicio DESC
            `;
            
            const sprintsResult = await pool.query(sprintsQuery, queryParams);
            
            // Resto del código para obtener devoluciones y usuarios...
            const devolucionesQuery = `
                SELECT d.*, u.username as user_username 
                FROM devoluciones d
                LEFT JOIN users u ON d.user_id = u.id
                WHERE d.sprint_id = $1
                ORDER BY d.fecha_creacion DESC
            `;
            
            const sprintsWithDevoluciones = await Promise.all(
                sprintsResult.rows.map(async sprint => {
                    const devoluciones = await pool.query(devolucionesQuery, [sprint.id]);
                    return { ...sprint, devoluciones: devoluciones.rows };
                })
            );

            // Obtener usuarios para filtro (solo admin)
            let users = [];
            if (req.session.user.role === 'admin') {
                const usersResult = await pool.query(`
                    SELECT id, username, role 
                    FROM users 
                    WHERE role IN ('auditoria', 'ventas', 'fulfillment')
                    ORDER BY username ASC
                `);
                users = usersResult.rows;
            }

            res.render('devoluciones', {
                user: req.session.user,
                sprints: sprintsWithDevoluciones,
                users,
                success: req.query.success,
                error: req.query.error,
                req: req // Pasamos req para acceder a los query params en la vista
            });

        } catch (error) {
            console.error("Error en GET /sprints:", error);
            res.status(500).render('error', {
                message: 'Error al cargar los sprints',
                error: error,
                user: req.session.user
            });
        }
    });
    
    // --- RUTAS PARA DEVOLUCIONES ---
    
    // POST /devoluciones - Crear nueva devolución
    app.post('/devoluciones', isAuthenticated, async (req, res) => {
        const { sprint_id, titulo, descripcion, prioridad, fecha_limite } = req.body;
        
        if (!sprint_id || !titulo || !descripcion) {
        return res.redirect('/sprints?error=Título y descripción son obligatorios');
        }
    
        try {
        const query = `
            INSERT INTO devoluciones 
            (sprint_id, user_id, titulo, descripcion, prioridad, fecha_limite)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        await pool.query(query, [
            sprint_id,
            req.session.user.id,
            titulo.trim(),
            descripcion.trim(),
            prioridad || 'media',
            fecha_limite || null
        ]);
    
        res.redirect(`/sprints?success=Devolución agregada correctamente#sprint-${sprint_id}`);
        } catch (error) {
        console.error("Error en POST /devoluciones:", error);
        res.redirect('/sprints?error=Error al crear la devolución');
        }
    });
    
    // PUT /devoluciones/:id/estado - Actualizar estado de devolución
    app.put('/devoluciones/:id/estado', isAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { estado, comentarios_completado } = req.body;
    
        if (!id || !estado) {
        return res.status(400).json({ success: false, message: 'Datos incompletos' });
        }
    
        try {
        // Verificar que la devolución existe y pertenece al usuario o es admin
        const verifyQuery = `
            SELECT * FROM devoluciones 
            WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
        `;
        const verifyResult = await pool.query(verifyQuery, [
            id, 
            req.session.user.id,
            req.session.user.role
        ]);
    
        if (verifyResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para modificar esta devolución' });
        }
    
        const updateQuery = `
            UPDATE devoluciones SET
            estado = $1,
            ${estado === 'completado' ? 
                'completado_por = $2, fecha_completado = CURRENT_TIMESTAMP, comentarios_completado = $3' : 
                'completado_por = NULL, fecha_completado = NULL, comentarios_completado = NULL'}
            WHERE id = $4
            RETURNING *
        `;
        
        const updateParams = estado === 'completado' ? 
            [estado, req.session.user.id, comentarios_completado || null, id] :
            [estado, id];
    
        const updateResult = await pool.query(updateQuery, updateParams);
    
        res.json({ 
            success: true, 
            message: 'Estado actualizado',
            devolucion: updateResult.rows[0]
        });
    
        } catch (error) {
        console.error("Error en PUT /devoluciones/:id/estado:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar el estado' });
        }
    });
    
    // PUT /devoluciones/:id - Editar devolución
    app.put('/devoluciones/:id', isAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { titulo, descripcion, prioridad, fecha_limite } = req.body;
    
        if (!id || !titulo || !descripcion) {
        return res.status(400).json({ success: false, message: 'Datos incompletos' });
        }
    
        try {
        // Verificar que la devolución existe y pertenece al usuario o es admin
        const verifyQuery = `
            SELECT * FROM devoluciones 
            WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
        `;
        const verifyResult = await pool.query(verifyQuery, [
            id, 
            req.session.user.id,
            req.session.user.role
        ]);
    
        if (verifyResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para modificar esta devolución' });
        }
    
        const updateQuery = `
            UPDATE devoluciones SET
            titulo = $1,
            descripcion = $2,
            prioridad = $3,
            fecha_limite = $4,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `;
        
        const updateResult = await pool.query(updateQuery, [
            titulo.trim(),
            descripcion.trim(),
            prioridad || 'media',
            fecha_limite || null,
            id
        ]);
    
        res.json({ 
            success: true, 
            message: 'Devolución actualizada',
            devolucion: updateResult.rows[0]
        });
    
        } catch (error) {
        console.error("Error en PUT /devoluciones/:id:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar la devolución' });
        }
    });


    // --- GET /planes-accion - Listado de planes ---
app.get('/planes-accion', isAuthenticated, async (req, res) => {
    try {
        // Obtener parámetros de filtro
        const { categoria, estado, vendedor } = req.query;
        
        // Construir consulta base
        let query = `
            SELECT pa.*, v.nombre as vendedor_nombre, 
                   cc.nombre as categoria_nombre, cc.color as categoria_color
            FROM planes_accion pa
            JOIN vendedores v ON pa.vendedor_id = v.id
            LEFT JOIN categorias_clientes cc ON pa.categoria_id = cc.id
            WHERE 1=1
        `;
        
        let params = [];
        
        // Aplicar filtros
        if (categoria) {
            query += ` AND pa.categoria_id = $${params.length + 1}`;
            params.push(categoria);
        }
        
        if (estado) {
            query += ` AND pa.estado = $${params.length + 1}`;
            params.push(estado);
        }
        
        if (vendedor) {
            query += ` AND pa.vendedor_id = $${params.length + 1}`;
            params.push(vendedor);
        }
        
        query += ` ORDER BY pa.updated_at DESC`;
        
        const planes = await pool.query(query, params);
        
        // Obtener categorías para el filtro
        const categorias = await pool.query('SELECT * FROM categorias_clientes ORDER BY nombre');
        
        // Obtener vendedores para el filtro
        const vendedores = await pool.query('SELECT id, nombre FROM vendedores ORDER BY nombre');
        
        res.render('planes_accion/listado', {
            user: req.session.user,
            planes: planes.rows,
            categorias: categorias.rows,
            vendedores: vendedores.rows,
            filters: { categoria, estado, vendedor },
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error("Error en GET /planes-accion:", error);
        res.status(500).render('error', {
            message: 'Error al cargar los planes de acción',
            error: error,
            user: req.session.user
        });
    }
});

// --- GET /planes-accion/nuevo - Formulario nuevo plan ---
app.get('/planes-accion/nuevo', isAuthenticated, async (req, res) => {
    try {
        const categorias = await pool.query('SELECT * FROM categorias_clientes ORDER BY nombre');
        const vendedores = await pool.query('SELECT id, nombre FROM vendedores ORDER BY nombre');
        
        res.render('planes_accion/nuevo', {
            user: req.session.user,
            categorias: categorias.rows,
            vendedores: vendedores.rows
        });
    } catch (error) {
        console.error("Error en GET /planes-accion/nuevo:", error);
        res.redirect('/planes-accion?error=Error al cargar el formulario');
    }
});

// --- POST /planes-accion - Crear nuevo plan ---
app.post('/planes-accion', isAuthenticated, async (req, res) => {
    const { vendedor_id, categoria_id, titulo, descripcion, fecha_inicio, fecha_limite } = req.body;
    
    if (!vendedor_id || !titulo) {
        return res.redirect('/planes-accion/nuevo?error=Vendedor y título son obligatorios');
    }

    try {
        const query = `
            INSERT INTO planes_accion 
            (vendedor_id, categoria_id, titulo, descripcion, fecha_inicio, fecha_limite)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        const result = await pool.query(query, [
            vendedor_id,
            categoria_id || null,
            titulo.trim(),
            descripcion || null,
            fecha_inicio || null,
            fecha_limite || null
        ]);
        
        const planId = result.rows[0].id;
        res.redirect(`/planes-accion/${planId}?success=Plan creado correctamente`);

    } catch (error) {
        console.error("Error en POST /planes-accion:", error);
        res.redirect('/planes-accion/nuevo?error=Error al crear el plan');
    }
});

// --- GET /planes-accion/:id - Detalle del plan ---
app.get('/planes-accion/:id', isAuthenticated, async (req, res) => {
    try {
        const planId = req.params.id;
        
        // Obtener información básica del plan
        const planQuery = `
            SELECT pa.*, v.nombre as vendedor_nombre, 
                   cc.nombre as categoria_nombre, cc.color as categoria_color
            FROM planes_accion pa
            JOIN vendedores v ON pa.vendedor_id = v.id
            LEFT JOIN categorias_clientes cc ON pa.categoria_id = cc.id
            WHERE pa.id = $1
        `;
        const planResult = await pool.query(planQuery, [planId]);
        
        if (planResult.rows.length === 0) {
            return res.status(404).render('error', {
                message: 'Plan no encontrado',
                error: { status: 404 },
                user: req.session.user
            });
        }
        
        const plan = planResult.rows[0];
        
        // Obtener fases del plan
        const fasesQuery = `
            SELECT * FROM fases_plan 
            WHERE plan_id = $1
            ORDER BY orden ASC
        `;
        const fasesResult = await pool.query(fasesQuery, [planId]);
        
        // Obtener actividades para cada fase
        const fasesConActividades = await Promise.all(
            fasesResult.rows.map(async fase => {
                const actividadesQuery = `
                    SELECT a.*, u.username as responsable_username
                    FROM actividades_plan a
                    LEFT JOIN users u ON a.responsable_id = u.id
                    WHERE a.fase_id = $1
                    ORDER BY a.created_at ASC
                `;
                const actividadesResult = await pool.query(actividadesQuery, [fase.id]);
                return {
                    ...fase,
                    actividades: actividadesResult.rows
                };
            })
        );
        
        // Obtener usuarios para asignar actividades
        const usuarios = await pool.query('SELECT id, username FROM users ORDER BY username');
        
        res.render('planes_accion/detalle', {
            user: req.session.user,
            plan: plan,
            fases: fasesConActividades,
            usuarios: usuarios.rows,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error(`Error en GET /planes-accion/${req.params.id}:`, error);
        res.status(500).render('error', {
            message: 'Error al cargar el plan',
            error: error,
            user: req.session.user
        });
    }
});

// --- POST /planes-accion/:id/fases - Añadir nueva fase ---
app.post('/planes-accion/:id/fases', isAuthenticated, async (req, res) => {
    const planId = req.params.id;
    const { nombre, color, descripcion } = req.body;
    
    if (!nombre || !color) {
        return res.redirect(`/planes-accion/${planId}?error=Nombre y color son obligatorios`);
    }

    try {
        // Verificar que no haya más de 10 fases
        const countQuery = 'SELECT COUNT(*) FROM fases_plan WHERE plan_id = $1';
        const countResult = await pool.query(countQuery, [planId]);
        
        if (parseInt(countResult.rows[0].count, 10) >= 10) {
            return res.redirect(`/planes-accion/${planId}?error=No se pueden agregar más de 10 fases por plan`);
        }
        
        // Obtener el siguiente orden
        const maxOrderQuery = 'SELECT COALESCE(MAX(orden), 0) + 1 as next_order FROM fases_plan WHERE plan_id = $1';
        const maxOrderResult = await pool.query(maxOrderQuery, [planId]);
        const nextOrder = maxOrderResult.rows[0].next_order;
        
        const insertQuery = `
            INSERT INTO fases_plan 
            (plan_id, nombre, color, orden, descripcion)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        await pool.query(insertQuery, [
            planId,
            nombre.trim(),
            color,
            nextOrder,
            descripcion || null
        ]);
        
        res.redirect(`/planes-accion/${planId}?success=Fase agregada correctamente`);

    } catch (error) {
        console.error("Error en POST /planes-accion/:id/fases:", error);
        res.redirect(`/planes-accion/${planId}?error=Error al agregar fase`);
    }
});

// --- PUT /planes-accion/fases/:id - Actualizar fase ---
app.put('/planes-accion/fases/:id', isAuthenticated, async (req, res) => {
    const faseId = req.params.id;
    const { nombre, color, descripcion, completado } = req.body;
    
    try {
        const query = `
            UPDATE fases_plan SET
                nombre = COALESCE($1, nombre),
                color = COALESCE($2, color),
                descripcion = COALESCE($3, descripcion),
                completado = $4,
                fecha_completado = CASE WHEN $4 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `;
        const result = await pool.query(query, [
            nombre,
            color,
            descripcion,
            completado === 'true',
            faseId
        ]);
        
        res.json({
            success: true,
            message: 'Fase actualizada',
            fase: result.rows[0]
        });

    } catch (error) {
        console.error("Error en PUT /api/planes-accion/fases/:id:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar fase' });
    }
});

// --- POST /planes-accion/fases/:id/actividades - Añadir actividad ---
app.post('/api/planes-accion/fases/:id/actividades', isAuthenticated, async (req, res) => {
    const faseId = req.params.id;
    const { titulo, descripcion, fecha_limite, responsable_id } = req.body;
    
    if (!titulo) {
        return res.status(400).json({ success: false, message: 'Título es obligatorio' });
    }

    try {
        const query = `
            INSERT INTO actividades_plan 
            (fase_id, titulo, descripcion, fecha_limite, responsable_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const result = await pool.query(query, [
            faseId,
            titulo.trim(),
            descripcion || null,
            fecha_limite || null,
            responsable_id || null
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Actividad agregada',
            actividad: result.rows[0]
        });

    } catch (error) {
        console.error("Error en POST /api/planes-accion/fases/:id/actividades:", error);
        res.status(500).json({ success: false, message: 'Error al agregar actividad' });
    }
});

// --- PUT /planes-accion/actividades/:id - Actualizar actividad ---
app.put('/planes-accion/actividades/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { completado } = req.body;
        
        // Actualizar solo el campo completado (y tal vez otros campos que existan)
        const result = await pool.query(
            'UPDATE actividades_plan SET completado = $1 WHERE id = $2 RETURNING *',
            [completado, id]
        );
        
        res.json({ success: true, actividad: result.rows[0] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- DELETE /api/planes-accion/fases/:id - Eliminar fase ---
app.delete('/planes-accion/fases/:id', isAuthenticated, async (req, res) => {
    const faseId = req.params.id;
    
    try {
        // Esto eliminará en cascada las actividades debido a ON DELETE CASCADE
        await pool.query('DELETE FROM fases_plan WHERE id = $1', [faseId]);
        
        res.json({
            success: true,
            message: 'Fase eliminada'
        });

    } catch (error) {
        console.error("Error en DELETE /api/planes-accion/fases/:id:", error);
        res.status(500).json({ success: false, message: 'Error al eliminar fase' });
    }
});


/*FUll fillment*/


/**
 * @api {get} /api/vendedores/:id/agendas/historial Historial de agendas por vendedor
 * @apiName GetAgendasHistorial
 * @apiGroup VendedoresAgendas
 * @apiPermission authenticated
 * 
 * @apiParam {Number} id ID del vendedor
 * @apiParam {String} [desde] Fecha inicial para rango (formato YYYY-MM-DD)
 * @apiParam {String} [hasta] Fecha final para rango (formato YYYY-MM-DD)
 * @apiParam {String} [insta_username] Filtrar por cuenta específica
 * 
 * @apiSuccess {Object} vendedor Datos del vendedor
 * @apiSuccess {Object[]} historial Lista de registros de agendas
 * @apiSuccess {Object} totales Totales de agendas por periodo
 */
app.get('/api/vendedores/:id/agendas/historial', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { desde, hasta, insta_username } = req.query;
    
    try {
        // Obtener datos del vendedor
        const vendedorQuery = 'SELECT id, nombre FROM vendedores WHERE id = $1';
        const vendedorResult = await pool.query(vendedorQuery, [id]);
        
        if (vendedorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor no encontrado'
            });
        }

        const vendedor = vendedorResult.rows[0];

        // Construir consulta para historial
        let historialQuery = `
            SELECT 
                fecha,
                insta_username,
                agendas_registradas,
                notas,
                created_at
            FROM vendedor_agendas_diarias
            WHERE vendedor_id = $1
        `;

        let params = [id];
        let paramCount = 1;

        if (desde && hasta) {
            paramCount += 2;
            historialQuery += ` AND fecha BETWEEN $${paramCount - 1} AND $${paramCount}`;
            params.push(desde, hasta);
        }

        if (insta_username) {
            paramCount += 1;
            historialQuery += ` AND insta_username = $${paramCount}`;
            params.push(insta_username.toLowerCase());
        }

        historialQuery += ' ORDER BY fecha DESC, insta_username ASC';

        const historialResult = await pool.query(historialQuery, params);

        // Consulta para totales
        let totalesQuery = `
            SELECT 
                SUM(agendas_registradas) as total_agendas,
                COUNT(DISTINCT fecha) as total_dias,
                COUNT(DISTINCT insta_username) as total_cuentas
            FROM vendedor_agendas_diarias
            WHERE vendedor_id = $1
        `;

        if (desde && hasta) {
            totalesQuery += ` AND fecha BETWEEN $2 AND $3`;
        }

        const totalesResult = await pool.query(
            totalesQuery, 
            desde && hasta ? [id, desde, hasta] : [id]
        );

        res.json({
            success: true,
            vendedor: vendedor,
            historial: historialResult.rows,
            totales: totalesResult.rows[0] || {
                total_agendas: 0,
                total_dias: 0,
                total_cuentas: 0
            }
        });

    } catch (error) {
        console.error(`Error en GET /api/vendedores/${id}/agendas/historial:`, error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el historial de agendas'
        });
    }
});

/**
 * @api {post} /api/vendedores/agendas Registrar o actualizar agendas
 * @apiName PostAgendas
 * @apiGroup VendedoresAgendas
 * @apiPermission authenticated
 * 
 * @apiParam {Number} vendedor_id ID del vendedor (requerido)
 * @apiParam {String} fecha Fecha en formato YYYY-MM-DD (requerido)
 * @apiParam {String} insta_username Nombre de la cuenta de Instagram (requerido)
 * @apiParam {Number} agendas_registradas Número de agendas (requerido)
 * @apiParam {String} [notas] Notas adicionales
 * 
 * @apiSuccess {Object} data Datos del registro creado/actualizado
 * @apiSuccess {String} message Mensaje de confirmación
 */
app.post('/api/vendedores/agendas', isAuthenticated, async (req, res) => {
    const { vendedor_id, insta_username, fecha, agendas_registradas, notas } = req.body;
    
    try {
        // Validar datos requeridos
        if (!vendedor_id || !insta_username || !fecha || agendas_registradas === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: vendedor_id, insta_username, fecha o agendas_registradas'
            });
        }

        // Verificar que el vendedor existe
        const vendedorCheck = await pool.query('SELECT id FROM vendedores WHERE id = $1', [vendedor_id]);
        if (vendedorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor no encontrado'
            });
        }

        // Insertar el registro de agenda
        const query = `
            INSERT INTO vendedor_agendas_diarias 
            (vendedor_id, insta_username, fecha, agendas_registradas, notas)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;
        
        const values = [
            vendedor_id,
            insta_username.toLowerCase(),
            fecha,
            parseInt(agendas_registradas) || 0,
            notas || null
        ];
        
        const result = await pool.query(query, values);
        
        // Actualizar el último seguimiento del vendedor
        await pool.query(
            'UPDATE vendedores SET ultimo_seguimiento = NOW() WHERE id = $1',
            [vendedor_id]
        );
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Agenda registrada correctamente'
        });
    } catch (error) {
        console.error("Error en POST /api/vendedores/agendas:", error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar el registro de agenda',
            error: error.message
        });
    }
});

app.get('/api/vendedores/:id/agendas', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { desde, hasta } = req.query;
    
    try {
        // Configurar fechas por defecto (últimos 30 días)
        const defaultEndDate = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultEndDate.getDate() - 30);
        
        const startDate = desde || defaultStartDate.toISOString().split('T')[0];
        const endDate = hasta || defaultEndDate.toISOString().split('T')[0];

        const query = `
            SELECT 
                a.id,
                a.fecha,
                a.insta_username,
                a.agendas_registradas,
                a.notas,
                a.created_at,
                v.nombre as vendedor_nombre
            FROM vendedor_agendas_diarias a
            JOIN vendedores v ON a.vendedor_id = v.id
            WHERE a.vendedor_id = $1
            AND a.fecha BETWEEN $2 AND $3
            ORDER BY a.fecha DESC
        `;

        const result = await pool.query(query, [id, startDate, endDate]);

        res.json({
            success: true,
            data: result.rows,
            vendedor_id: id,
            vendedor_nombre: result.rows[0]?.vendedor_nombre || '',
            desde: startDate,
            hasta: endDate
        });

    } catch (error) {
        console.error("Error en GET /api/vendedores/:id/agendas:", error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las agendas del vendedor'
        });
    }
});
// Agregar este nuevo endpoint antes de las demás rutas
app.get('/api/vendedores/:id/cuentas', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'SELECT cuentas_asignadas FROM vendedores WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor no encontrado'
            });
        }
        
        // Extraer las cuentas del campo JSONB
        const cuentas = result.rows[0].cuentas_asignadas || [];
        
        res.json({
            success: true,
            cuentas: cuentas
        });
    } catch (error) {
        console.error("Error al obtener cuentas del vendedor:", error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las cuentas del vendedor'
        });
    }
});

app.get('/api/vendedores/agendas', isAuthenticated, async (req, res) => {
    const { desde, hasta, vendedor_id } = req.query;
    
    try {
        // 1. Obtener la lista completa de vendedores
        const vendedoresQuery = 'SELECT id, nombre FROM vendedores ORDER BY nombre ASC';
        const vendedoresResult = await pool.query(vendedoresQuery);
        const vendedores = vendedoresResult.rows;

        // 2. Configurar fechas por defecto (últimos 7 días)
        const defaultEndDate = new Date();
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultEndDate.getDate() - 7);
        
        const initialStartDate = desde || defaultStartDate.toISOString().split('T')[0];
        const initialEndDate = hasta || defaultEndDate.toISOString().split('T')[0];

        // 3. Obtener datos directamente desde la base de datos
        const resumenQuery = `
            SELECT 
                v.id as vendedor_id,
                v.nombre as vendedor_nombre,
                COUNT(DISTINCT a.insta_username) as total_cuentas,
                SUM(a.agendas_registradas) as total_agendas,
                MAX(a.created_at) as ultimo_seguimiento
            FROM vendedores v
            LEFT JOIN vendedor_agendas_diarias a ON v.id = a.vendedor_id
            WHERE a.fecha BETWEEN $1 AND $2
            ${vendedor_id ? 'AND v.id = $3' : ''}
            GROUP BY v.id, v.nombre
            ORDER BY v.nombre ASC
        `;

        const detalleQuery = `
            SELECT 
                a.id,
                a.vendedor_id,
                v.nombre as vendedor_nombre,
                a.fecha,
                a.insta_username,
                a.agendas_registradas,
                a.notas,
                a.created_at
            FROM vendedor_agendas_diarias a
            JOIN vendedores v ON a.vendedor_id = v.id
            WHERE a.fecha BETWEEN $1 AND $2
            ${vendedor_id ? 'AND a.vendedor_id = $3' : ''}
            ORDER BY a.fecha DESC
            LIMIT 10
        `;

        const queryParams = vendedor_id 
            ? [initialStartDate, initialEndDate, vendedor_id] 
            : [initialStartDate, initialEndDate];

        const [resumenResult, detalleResult] = await Promise.all([
            pool.query(resumenQuery, queryParams),
            pool.query(detalleQuery, queryParams)
        ]);

        // 4. Renderizar la vista
        res.render('vendedores/vendedores_agendas', {
            user: req.session.user,
            vendedores: vendedores,
            resumen: resumenResult.rows,
            detalle: detalleResult.rows,
            filters: {
                desde: initialStartDate,
                hasta: initialEndDate,
                vendedor_id: vendedor_id || ''
            },
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error("Error en GET /vendedores/agendas:", error);
        res.redirect('/onboarding?error=Error al cargar las agendas de vendedores');
    }
});
app.get('/api/vendedores/agendas/detalle', isAuthenticated, async (req, res) => {
    const { insta_username, desde, hasta, vendedor_id, limit = 30 } = req.query;
    
    if (!insta_username) {
        return res.status(400).json({
            success: false,
            message: 'El parámetro insta_username es requerido'
        });
    }

    try {
        let query = `
            SELECT 
                a.id,
                a.vendedor_id,
                v.nombre as vendedor_nombre,
                a.fecha,
                a.insta_username,
                a.agendas_registradas,
                a.notas,
                a.created_at
            FROM vendedor_agendas_diarias a
            JOIN vendedores v ON a.vendedor_id = v.id
            WHERE a.insta_username = $1
        `;

        let params = [insta_username.toLowerCase()];
        let paramCount = 1;

        if (desde && hasta) {
            paramCount += 2;
            query += ` AND a.fecha BETWEEN $${paramCount - 1} AND $${paramCount}`;
            params.push(desde, hasta);
        }

        if (vendedor_id) {
            paramCount += 1;
            query += ` AND a.vendedor_id = $${paramCount}`;
            params.push(vendedor_id);
        }

        query += ` ORDER BY a.fecha DESC LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit, 10));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("Error en GET /api/vendedores/agendas/detalle:", error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el detalle de agendas'
        });
    }
});

app.put('/api/vendedores/agendas/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { agendas_registradas, notas } = req.body;
    
    try {
        // Validar datos requeridos
        if (agendas_registradas === undefined) {
            return res.status(400).json({
                success: false,
                message: 'El campo agendas_registradas es requerido'
            });
        }

        const query = `
            UPDATE vendedor_agendas_diarias 
            SET 
                agendas_registradas = $1,
                notas = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `;
        
        const values = [
            parseInt(agendas_registradas) || 0,
            notas || null,
            id
        ];
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registro no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Registro actualizado correctamente'
        });
    } catch (error) {
        console.error("Error en PUT /api/vendedores/agendas/:id:", error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el registro'
        });
    }
});

/**
 * @api {get} /api/vendedores/agendas/resumen Obtener resumen de agendas
 * @apiName GetAgendasResumen
 * @apiGroup VendedoresAgendas
 * @apiPermission authenticated
 * 
 * @apiParam {String} [fecha] Fecha en formato YYYY-MM-DD (por defecto hoy)
 * @apiParam {String} [desde] Fecha inicial para rango (formato YYYY-MM-DD)
 * @apiParam {String} [hasta] Fecha final para rango (formato YYYY-MM-DD)
 * @apiParam {Number} [vendedor_id] Filtrar por ID de vendedor específico
 * 
 * @apiSuccess {Object[]} data Lista de resúmenes por vendedor
 * @apiSuccess {Number} data.vendedor_id ID del vendedor
 * @apiSuccess {String} data.vendedor_nombre Nombre del vendedor
 * @apiSuccess {Number} data.total_agendas Total de agendas registradas
 * @apiSuccess {Number} data.total_cuentas Total de cuentas con registros
 * @apiSuccess {Object[]} data.cuentas Detalle por cuenta
 * @apiSuccess {String} data.cuentas.insta_username Nombre de la cuenta
 * @apiSuccess {Number} data.cuentas.agendas Número de agendas
 * @apiSuccess {String} data.cuentas.notas Notas registradas
 */
app.get('/api/vendedores/agendas/resumen', isAuthenticated, async (req, res) => {
    const { fecha, desde, hasta, vendedor_id } = req.query;
    
    try {
        // Validar fechas
        let fechaInicio, fechaFin;
        if (fecha) {
            fechaInicio = fechaFin = fecha;
        } else if (desde && hasta) {
            fechaInicio = desde;
            fechaFin = hasta;
        } else {
            // Por defecto: hoy
            const hoy = new Date().toISOString().split('T')[0];
            fechaInicio = fechaFin = hoy;
        }

        // Construir consulta
        let query = `
            SELECT 
                v.id as vendedor_id,
                v.nombre as vendedor_nombre,
                COUNT(DISTINCT a.insta_username) as total_cuentas,
                SUM(a.agendas_registradas) as total_agendas,
                jsonb_agg(
                    jsonb_build_object(
                        'insta_username', a.insta_username,
                        'agendas', a.agendas_registradas,
                        'notas', a.notas
                    )
                ) as cuentas
            FROM vendedores v
            LEFT JOIN vendedor_agendas_diarias a ON v.id = a.vendedor_id
            WHERE a.fecha BETWEEN $1 AND $2
        `;

        let params = [fechaInicio, fechaFin];

        if (vendedor_id) {
            query += ' AND v.id = $3';
            params.push(vendedor_id);
        }

        query += ' GROUP BY v.id, v.nombre ORDER BY v.nombre ASC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        });

    } catch (error) {
        console.error("Error en GET /api/vendedores/agendas/resumen:", error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el resumen de agendas'
        });
    }
});

    app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
    });

    app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);    
    });