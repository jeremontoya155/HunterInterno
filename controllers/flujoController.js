const flujos = {}; // Almacenamiento en memoria de los flujos

const flujoController = {
  // Obtener el flujo del usuario
  getFlujo(req, res) {
    try {
      // Verificar si el usuario está autenticado
      if (!req.session.user) {
        return res.redirect('/login');
      }

      const userId = req.session.user.id;

      // Si el usuario no tiene un flujo, crear uno vacío
      if (!flujos[userId]) {
        flujos[userId] = { nombre: 'Mi Flujo', nodos: [] };
      }

      // Enviar el flujo a la vista
      res.render('flujo', { flujo: flujos[userId] });
    } catch (error) {
      console.error('Error al obtener el flujo:', error);
      res.status(500).send('Error al obtener el flujo');
    }
  },

  // Guardar el flujo del usuario
  postFlujo(req, res) {
    try {
      // Verificar si el usuario está autenticado
      if (!req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const userId = req.session.user.id;
      const { nombre, nodos } = req.body;

      // Guardar el flujo en memoria
      flujos[userId] = { nombre, nodos };
      res.status(200).json({ message: 'Flujo guardado correctamente' });
    } catch (error) {
      console.error('Error al guardar el flujo:', error);
      res.status(500).json({ error: 'Error al guardar el flujo' });
    }
  },
};

module.exports = flujoController;