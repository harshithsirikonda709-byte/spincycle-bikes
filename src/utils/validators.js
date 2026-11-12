const { AppError } = require('../middleware/errorHandler');

const ALLOWED_BIKE_STATUSES = ['available', 'rented', 'maintenance'];
const CREATION_BIKE_STATUSES = ['available', 'maintenance'];

/**
 * Parses and validates a positive integer identifier (e.g., route `:id` or foreign key ID).
 */
function parsePositiveInt(value, fieldName = 'id') {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      throw new AppError(`${fieldName} must be a positive integer`, 400);
    }
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new AppError(`${fieldName} must be a positive integer`, 400);
}

/**
 * Validates that a field is a non-empty trimmed string.
 */
function parseRequiredString(value, fieldName, maxLength = 120) {
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} is required and must be a string`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(`${fieldName} cannot be empty`, 400);
  }

  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400
    );
  }

  return trimmed;
}

/**
 * Validates that a request body is a plain JSON object.
 */
function ensureJsonObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a valid JSON object', 400);
  }
}

/**
 * Validates a date/datetime string and returns an ISO-8601 string.
 */
function parseValidDate(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} must be a valid date string`, 400);
  }

  const timestamp = Date.parse(value.trim());
  if (Number.isNaN(timestamp)) {
    throw new AppError(`${fieldName} is not a valid date`, 400);
  }

  return new Date(timestamp).toISOString();
}

module.exports = {
  ALLOWED_BIKE_STATUSES,
  CREATION_BIKE_STATUSES,
  parsePositiveInt,
  parseRequiredString,
  ensureJsonObject,
  parseValidDate,
};

