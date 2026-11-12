const { AppError } = require('../middleware/errorHandler');
const {
  ensureJsonObject,
  parsePositiveInt,
  parseValidDate,
} = require('../utils/validators');

/**
 * Controller for Rental endpoints.
 */
function createRentalController(rentalModel) {
  async function getAllRentals(req, res, next) {
    try {
      const rentals = await rentalModel.getAllRentals();
      return res.status(200).json(rentals);
    } catch (err) {
      return next(err);
    }
  }

  async function getRentalDetails(req, res, next) {
    try {
      const details = await rentalModel.getRentalDetails();
      return res.status(200).json(details);
    } catch (err) {
      return next(err);
    }
  }

  async function createRental(req, res, next) {
    try {
      ensureJsonObject(req.body);

      const rider_id = parsePositiveInt(req.body.rider_id, 'rider_id');
      const bike_id = parsePositiveInt(req.body.bike_id, 'bike_id');

      const rental_date =
        req.body.rental_date !== undefined
          ? parseValidDate(req.body.rental_date, 'rental_date')
          : new Date().toISOString();

      let return_date = null;
      if (req.body.return_date !== undefined && req.body.return_date !== null) {
        return_date = parseValidDate(req.body.return_date, 'return_date');
        if (Date.parse(return_date) < Date.parse(rental_date)) {
          throw new AppError(
            'return_date cannot be earlier than rental_date',
            400
          );
        }
      }

      const rental = await rentalModel.createRental({
        rider_id,
        bike_id,
        rental_date,
        return_date,
      });

      return res.status(201).json(rental);
    } catch (err) {
      return next(err);
    }
  }

  async function returnRental(req, res, next) {
    try {
      const id = parsePositiveInt(req.params.id, 'id');

      let returnDate = new Date().toISOString();
      if (req.body !== undefined) {
        ensureJsonObject(req.body);
        if (
          req.body.return_date !== undefined &&
          req.body.return_date !== null
        ) {
          returnDate = parseValidDate(req.body.return_date, 'return_date');
        }
      }

      const updated = await rentalModel.returnRental(id, returnDate);
      return res.status(200).json(updated);
    } catch (err) {
      return next(err);
    }
  }

  return {
    getAllRentals,
    getRentalDetails,
    createRental,
    returnRental,
  };
}

module.exports = {
  createRentalController,
};

