const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // Set default values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let moduleName = error.module || 'EXPRESS_SERVER';
  let details = error.details || null;

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    moduleName = 'DATABASE_MODEL';
    message = `Invalid format for field '${err.path}': ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    moduleName = 'DATABASE_VALIDATION';
    const validationErrors = Object.values(err.errors).map(e => e.message);
    message = `Validation Failed: ${validationErrors.join(', ')}`;
    details = validationErrors;
  }

  // Handle MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    moduleName = 'DATABASE_DUPLICATE_KEY';
    const keys = Object.keys(err.keyValue || {});
    message = `Duplicate field value entered for [${keys.join(', ')}]. Value must be unique.`;
  }

  // Handle JWT Verification Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    moduleName = 'AUTH_TOKEN_VERIFICATION';
    message = 'Invalid authentication token signature.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    moduleName = 'AUTH_TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log error with explicit module section context
  logger.error(moduleName, message, err, req);

  // Return structured response payload
  res.status(statusCode).json({
    success: false,
    module: moduleName,
    message,
    statusCode,
    details,
    path: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorMiddleware;
