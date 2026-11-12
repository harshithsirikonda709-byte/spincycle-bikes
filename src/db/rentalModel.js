const { AppError } = require('../middleware/errorHandler');

/**
 * Data access layer for the `rentals` table.
 * Enforces foreign-key existence, prevents duplicate active rentals,
 * and keeps bike availability synchronized inside transactions.
 */
function createRentalModel(db) {
  async function getAllRentals() {
    return db.all(
      'SELECT id, rider_id, bike_id, rental_date, return_date FROM rentals ORDER BY id ASC'
    );
  }

  async function getRentalById(id) {
    return db.get(
      'SELECT id, rider_id, bike_id, rental_date, return_date FROM rentals WHERE id = ?',
      [id]
    );
  }

  /**
   * Returns rental records joined with rider and bike information.
   */
  async function getRentalDetails() {
    return db.all(`
      SELECT
        rentals.id,
        rentals.rider_id,
        riders.name AS rider_name,
        riders.phone AS rider_phone,
        rentals.bike_id,
        bikes.bike_code,
        bikes.name AS bike_name,
        bikes.type AS bike_type,
        bikes.status AS bike_status,
        rentals.rental_date,
        rentals.return_date
      FROM rentals
      INNER JOIN riders ON rentals.rider_id = riders.id
      INNER JOIN bikes ON rentals.bike_id = bikes.id
      ORDER BY rentals.id ASC
    `);
  }

  async function createRental({ rider_id, bike_id, rental_date, return_date = null }) {
    return db.withTransaction(async (tx) => {
      const rider = await tx.get('SELECT id FROM riders WHERE id = ?', [rider_id]);
      if (!rider) {
        throw new AppError(`Rider with id ${rider_id} not found`, 404);
      }

      const bike = await tx.get(
        'SELECT id, status FROM bikes WHERE id = ?',
        [bike_id]
      );
      if (!bike) {
        throw new AppError(`Bike with id ${bike_id} not found`, 404);
      }

      // Prevent duplicate active rentals or renting bikes under maintenance,
      // even if a return_date is provided on creation.
      const activeRental = await tx.get(
        'SELECT id FROM rentals WHERE bike_id = ? AND return_date IS NULL LIMIT 1',
        [bike_id]
      );

      if (activeRental || bike.status === 'rented') {
        throw new AppError(
          `Bike with id ${bike_id} is already rented`,
          409
        );
      }

      if (bike.status === 'maintenance') {
        throw new AppError(
          `Bike with id ${bike_id} is currently under maintenance and cannot be rented`,
          409
        );
      }

      const result = await tx.run(
        'INSERT INTO rentals (rider_id, bike_id, rental_date, return_date) VALUES (?, ?, ?, ?)',
        [rider_id, bike_id, rental_date, return_date]
      );

      if (return_date === null) {
        await tx.run(
          "UPDATE bikes SET status = 'rented' WHERE id = ?",
          [bike_id]
        );
      }

      return tx.get(
        'SELECT id, rider_id, bike_id, rental_date, return_date FROM rentals WHERE id = ?',
        [result.lastID]
      );
    });
  }

  async function returnRental(id, returnDate) {
    return db.withTransaction(async (tx) => {
      const rental = await tx.get(
        'SELECT id, rider_id, bike_id, rental_date, return_date FROM rentals WHERE id = ?',
        [id]
      );

      if (!rental) {
        throw new AppError(`Rental with id ${id} not found`, 404);
      }

      if (rental.return_date !== null) {
        throw new AppError(`Rental with id ${id} is already returned`, 409);
      }

      if (Date.parse(returnDate) < Date.parse(rental.rental_date)) {
        throw new AppError('return_date cannot be earlier than rental_date', 400);
      }

      await tx.run(
        'UPDATE rentals SET return_date = ? WHERE id = ?',
        [returnDate, id]
      );

      await tx.run(
        "UPDATE bikes SET status = 'available' WHERE id = ?",
        [rental.bike_id]
      );

      return tx.get(
        'SELECT id, rider_id, bike_id, rental_date, return_date FROM rentals WHERE id = ?',
        [id]
      );
    });
  }

  return {
    getAllRentals,
    getRentalById,
    getRentalDetails,
    createRental,
    returnRental,
  };
}

module.exports = {
  createRentalModel,
};

