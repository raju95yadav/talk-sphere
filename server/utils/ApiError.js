class ApiError extends Error {
  constructor(statusCode, message, module = 'GENERAL', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.module = module;
    this.details = details;
    this.success = false;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
