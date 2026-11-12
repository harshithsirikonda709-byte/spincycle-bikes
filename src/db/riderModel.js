/**
 * Data access layer for the `riders` table.
 * All queries use parameterized placeholders to prevent SQL injection.
 */
function createRiderModel(db) {
  async function getAllRiders() {
    return db.all('SELECT id, name, phone FROM riders ORDER BY id ASC');
  }

  async function getRiderById(id) {
    return db.get('SELECT id, name, phone FROM riders WHERE id = ?', [id]);
  }

  async function createRider({ name, phone }) {
    const result = await db.run(
      'INSERT INTO riders (name, phone) VALUES (?, ?)',
      [name, phone]
    );
    return getRiderById(result.lastID);
  }

  return {
    getAllRiders,
    getRiderById,
    createRider,
  };
}

module.exports = {
  createRiderModel,
};

