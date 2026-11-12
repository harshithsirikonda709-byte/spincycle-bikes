const { AppError } = require('../middleware/errorHandler');
const {
  ensureJsonObject,
  parseRequiredString,
} = require('../utils/validators');

const PHONE_PATTERN = /^[+\d\s()-]{7,20}$/;

/**
 * Validates a phone number string containing 7-20 valid phone characters.
 */
function parseValidPhone(value) {
  const phone = parseRequiredString(value, 'phone', 20);
  const digitCount = phone.replace(/\D/g, '').length;

  if (!PHONE_PATTERN.test(phone) || digitCount < 7) {
    throw new AppError(
      'phone must be a valid phone number containing at least 7 digits',
      400
    );
  }

  return phone;
}

/**
 * Controller for Rider endpoints.
 */
function createRiderController(riderModel) {
  async function getAllRiders(req, res, next) {
    try {
      const riders = await riderModel.getAllRiders();
      return res.status(200).json(riders);
    } catch (err) {
      return next(err);
    }
  }

  async function createRider(req, res, next) {
    try {
      ensureJsonObject(req.body);
      const name = parseRequiredString(req.body.name, 'name', 100);
      const phone = parseValidPhone(req.body.phone);

      const rider = await riderModel.createRider({ name, phone });
      return res.status(201).json(rider);
    } catch (err) {
      return next(err);
    }
  }

  return {
    getAllRiders,
    createRider,
  };
}

module.exports = {
  createRiderController,
};

