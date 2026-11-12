const { AppError } = require('../middleware/errorHandler');

/**
 * Formats a sequential integer ID into the standard SpinCycle bike code (e.g., 1 -> BKE-0001).
 */
function formatBikeCode(sequenceNumber) {
  return `BKE-${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Data access layer for the `bikes` table.
 * Enforces server-side sequential `bike_code` generation and immutability.
 */
function createBikeModel(db) {
  async function getAllBikes({ type } = {}) {
    if (type !== undefined) {
      return db.all(
        'SELECT id, bike_code, name, type, status FROM bikes WHERE LOWER(type) = LOWER(?) ORDER BY id ASC',
        [type]
      );
    }

    return db.all(
      'SELECT id, bike_code, name, type, status FROM bikes ORDER BY id ASC'
    );
  }

  async function getBikeById(id) {
    return db.get(
      'SELECT id, bike_code, name, type, status FROM bikes WHERE id = ?',
      [id]
    );
  }

  /**
   * Inserts a new bike inside an IMMEDIATE transaction and generates its
   * sequential unique `bike_code` (BKE-0001, BKE-0002, ...) from AUTOINCREMENT id.
   * Because SQLite AUTOINCREMENT never reuses deleted IDs, deleted bike codes are never reused.
   */
  async function createBike({ name, type, status = 'available' }) {
    return db.withTransaction(async (tx) => {
      const insertResult = await tx.run(
        'INSERT INTO bikes (bike_code, name, type, status) VALUES (?, ?, ?, ?)',
        ['__PENDING__', name, type, status]
      );

      const bikeCode = formatBikeCode(insertResult.lastID);

      await tx.run(
        'UPDATE bikes SET bike_code = ? WHERE id = ?',
        [bikeCode, insertResult.lastID]
      );

      return tx.get(
        'SELECT id, bike_code, name, type, status FROM bikes WHERE id = ?',
        [insertResult.lastID]
      );
    });
  }

  /**
   * Updates mutable bike fields (`name`, `type`, `status`).
   * `bike_code` is intentionally omitted so it can never be changed on update.
   */
  async function updateBike(id, { name, type, status }) {
    return db.withTransaction(async (tx) => {
      const existing = await tx.get(
        'SELECT id, bike_code, name, type, status FROM bikes WHERE id = ?',
        [id]
      );

      if (!existing) {
        return null;
      }

      const nextName = name !== undefined ? name : existing.name;
      const nextType = type !== undefined ? type : existing.type;
      const nextStatus = status !== undefined ? status : existing.status;

      // Prevent manually changing status away from 'rented' while an active rental exists,
      // and prevent manually transitioning an unrented bike to 'rented' without a rental.
      if (status !== undefined && status !== existing.status) {
        const activeRental = await tx.get(
          'SELECT id FROM rentals WHERE bike_id = ? AND return_date IS NULL LIMIT 1',
          [id]
        );
        if (activeRental) {
          throw new AppError(
            'Cannot manually change bike status while it has an active rental',
            409
          );
        }

        if (nextStatus === 'rented') {
          throw new AppError(
            'Bike status cannot be manually set to "rented"; create a rental via POST /rentals instead',
            400
          );
        }
      }

      await tx.run(
        'UPDATE bikes SET name = ?, type = ?, status = ? WHERE id = ?',
        [nextName, nextType, nextStatus, id]
      );

      return tx.get(
        'SELECT id, bike_code, name, type, status FROM bikes WHERE id = ?',
        [id]
      );
    });
  }

  async function deleteBike(id) {
    return db.withTransaction(async (tx) => {
      const existing = await tx.get(
        'SELECT id, bike_code, name, type, status FROM bikes WHERE id = ?',
        [id]
      );

      if (!existing) {
        return null;
      }

      const activeRental = await tx.get(
        'SELECT id FROM rentals WHERE bike_id = ? AND return_date IS NULL LIMIT 1',
        [id]
      );
      if (activeRental || existing.status === 'rented') {
        throw new AppError(
          'Cannot delete a bike that is currently rented',
          409
        );
      }

      const anyRental = await tx.get(
        'SELECT id FROM rentals WHERE bike_id = ? LIMIT 1',
        [id]
      );
      if (anyRental) {
        throw new AppError(
          'Cannot delete a bike that has existing rental records',
          409
        );
      }

      await tx.run('DELETE FROM bikes WHERE id = ?', [id]);
      return existing;
    });
  }

  return {
    getAllBikes,
    getBikeById,
    createBike,
    updateBike,
    deleteBike,
  };
}

module.exports = {
  createBikeModel,
  formatBikeCode,
};

