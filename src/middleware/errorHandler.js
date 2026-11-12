/**
 * Custom application error class with an HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/**
 * 404 handler for unmatched routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

/**
 * Centralized Express error-handling middleware.
 */
function errorHandler(err, req, res, next) {
  // Handle malformed JSON payloads from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON payload in request body',
    });
  }

  // Handle SQLite constraint errors cleanly if they bubble up
  if (err && err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Database constraint violation: ' + err.message,
    });
  }

  const statusCode = err.statusCode || 500;
  const response = {
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
    message: statusCode >= 500 ? 'An unexpected error occurred' : err.message,
  };

  if (statusCode < 500 && err.details !== undefined) {
    response.details = err.details;
  }

  if (statusCode >= 500) {
    console.error('[Server Error]', err);
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};

