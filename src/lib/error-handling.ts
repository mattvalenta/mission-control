/**
 * Error Handling Utilities
 * 
 * Standardized error handling for Mission Control.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      'NOT_FOUND',
      404
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, retryAfter?: number) {
    super(
      `${service} is unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      { service, retryAfter }
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common database errors
    if (error.message.includes('unique constraint')) {
      return new ConflictError('Resource already exists', { original: error.message });
    }

    if (error.message.includes('foreign key constraint')) {
      return new ValidationError('Invalid reference', { original: error.message });
    }

    if (error.message.includes('connection')) {
      return new ServiceUnavailableError('Database');
    }

    return new AppError(error.message, 'INTERNAL_ERROR', 500);
  }

  return new AppError('Unknown error', 'UNKNOWN', 500);
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: AppError | Error) {
  const appError = error instanceof AppError ? error : toAppError(error);

  return {
    error: appError.message,
    code: appError instanceof AppError ? appError.code : 'INTERNAL_ERROR',
    ...(appError instanceof AppError && appError.details ? { details: appError.details } : {}),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log error with context
 */
export function logError(
  error: Error,
  context: {
    operation?: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
  } = {}
) {
  console.error('[Error]', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Try-catch wrapper for async functions
 */
export function tryCatch<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => T
): Promise<T | undefined> {
  return fn().catch((error) => {
    logError(error);
    if (onError) {
      return onError(error);
    }
    return undefined;
  });
}

/**
 * Retry with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}
