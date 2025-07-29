/**
 * Base Error Class
 */
class BaseError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

/**
 * Bad Request Error (400)
 * Used for validation errors and invalid requests
 */
export class BadRequestError extends BaseError {
  constructor(message = 'Bad Request', details = null) {
    super(message, details);
    this.statusCode = 400;
  }
}

/**
 * Unauthorized Error (401)
 * Used when authentication is required but failed
 */
export class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, details);
    this.statusCode = 401;
  }
}

/**
 * Forbidden Error (403)
 * Used when user doesn't have permissions
 */
export class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden', details = null) {
    super(message, details);
    this.statusCode = 403;
  }
}

/**
 * Not Found Error (404)
 * Used when resource doesn't exist
 */
export class NotFoundError extends BaseError {
  constructor(message = 'Not Found', details = null) {
    super(message, details);
    this.statusCode = 404;
  }
}

/**
 * Conflict Error (409)
 * Used for duplicate resources or version conflicts
 */
export class ConflictError extends BaseError {
  constructor(message = 'Conflict', details = null) {
    super(message, details);
    this.statusCode = 409;
  }
}

/**
 * Validation Error (422)
 * Special case for complex validation errors
 */
export class ValidationError extends BadRequestError {
  constructor(message = 'Validation Failed', details = null) {
    super(message, details);
    this.statusCode = 422;
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
export class InternalServerError extends BaseError {
  constructor(message = 'Internal Server Error', details = null) {
    super(message, details);
    this.statusCode = 500;
  }
}

/**
 * Service Unavailable Error (503)
 * Used when service is temporarily unavailable
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message = 'Service Unavailable', details = null) {
    super(message, details);
    this.statusCode = 503;
  }
}

/**
 * Database Error
 * Wrapper for database-related errors
 */
export class DatabaseError extends InternalServerError {
  constructor(message = 'Database Error', details = null) {
    super(message, details);
  }
}

/**
 * API Error
 * For errors from external API calls
 */
export class APIError extends BaseError {
  constructor(message = 'API Error', details = null, statusCode = 500) {
    super(message, details);
    this.statusCode = statusCode;
  }
}

// Utility function to create error responses
export const createErrorResponse = (error, includeStack = false) => {
  const response = {
    success: false,
    error: {
      name: error.name,
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(includeStack && { stack: error.stack })
    }
  };

  if (error.statusCode) {
    response.statusCode = error.statusCode;
  }

  return response;
};

// Middleware for error handling
export const errorHandler = (err, req, res, next) => {
  // Log the error
  console.error(`[${new Date().toISOString()}] Error:`, err);

  // Determine the status code
  const statusCode = err.statusCode || 500;

  // Create error response
  const errorResponse = createErrorResponse(err, process.env.NODE_ENV === 'development');

  res.status(statusCode).json(errorResponse);
};