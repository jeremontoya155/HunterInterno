const pool = require('../db'); // Importar la conexión a PostgreSQL

const flujoModel = {
  // Guardar un nuevo flujo
  async createFlujo(userId, nombre, flujo) {
    const query = `
      INSERT INTO flujos (user_id, nombre, flujo)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [userId, nombre, flujo];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  // Obtener todos los flujos de un usuario
  async getFlujosByUserId(userId) {
    const query = `
      SELECT * FROM flujos
      WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  },

  // Obtener un flujo por su ID
  async getFlujoById(flujoId) {
    const query = `
      SELECT * FROM flujos
      WHERE id = $1;
    `;
    const { rows } = await pool.query(query, [flujoId]);
    return rows[0];
  },

  // Actualizar un flujo existente
  async updateFlujo(flujoId, nombre, flujo) {
    const query = `
      UPDATE flujos
      SET nombre = $1, flujo = $2
      WHERE id = $3
      RETURNING *;
    `;
    const values = [nombre, flujo, flujoId];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  // Eliminar un flujo
  async deleteFlujo(flujoId) {
    const query = `
      DELETE FROM flujos
      WHERE id = $1;
    `;
    await pool.query(query, [flujoId]);
  },
};

module.exports = flujoModel;