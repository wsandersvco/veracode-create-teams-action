/**
 * Error handling framework for Veracode Create Teams Action
 */

/**
 * Error categories for different failure scenarios
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  API_ERROR = 'api_error',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  NOT_FOUND = 'not_found'
}

/**
 * Custom error class with category and retry information
 */
export class VeracodeActionError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'VeracodeActionError'
    Object.setPrototypeOf(this, VeracodeActionError.prototype)
  }
}

/**
 * Categorizes an error based on its properties
 */
export function categorizeError(error: Error | unknown): ErrorCategory {
  // Type guard for error-like objects
  const err = error as {
    response?: { status?: number }
    code?: string
  }

  // Check for HTTP response status codes
  if (err.response?.status === 401) {
    return ErrorCategory.AUTHENTICATION
  }
  if (err.response?.status === 403) {
    return ErrorCategory.AUTHORIZATION
  }
  if (err.response?.status === 400) {
    return ErrorCategory.VALIDATION
  }
  if (err.response?.status === 404) {
    return ErrorCategory.NOT_FOUND
  }
  if (err.response?.status && err.response.status >= 500) {
    return ErrorCategory.API_ERROR
  }

  // Check for network errors
  if (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ENETUNREACH'
  ) {
    return ErrorCategory.NETWORK
  }

  // Check if it's already a VeracodeActionError
  if (error instanceof VeracodeActionError) {
    return error.category
  }

  // Default to configuration error for unknown errors
  return ErrorCategory.CONFIGURATION
}

/**
 * Determines if an error is retryable based on category and status code
 */
export function isRetryable(
  category: ErrorCategory,
  statusCode?: number
): boolean {
  // Rate limiting (429) is retryable regardless of category
  if (statusCode === 429) {
    return true
  }

  // Network errors are always retryable
  if (category === ErrorCategory.NETWORK) {
    return true
  }

  // Server errors (5xx) are retryable
  if (category === ErrorCategory.API_ERROR && statusCode) {
    return [500, 502, 503, 504].includes(statusCode)
  }

  // All other errors are not retryable
  return false
}

/**
 * Creates a user-friendly error message based on error category
 */
export function getUserFriendlyMessage(
  category: ErrorCategory,
  originalMessage: string
): string {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return `Authentication failed. Please check your Veracode API credentials. ${originalMessage}`

    case ErrorCategory.AUTHORIZATION:
      return `Authorization failed. Ensure your API user has Team Admin permissions. ${originalMessage}`

    case ErrorCategory.VALIDATION:
      return `Validation error. Check your input parameters and configuration. ${originalMessage}`

    case ErrorCategory.API_ERROR:
      return `Veracode API error. The service may be temporarily unavailable. ${originalMessage}`

    case ErrorCategory.NETWORK:
      return `Network error. Please check your connection and try again. ${originalMessage}`

    case ErrorCategory.CONFIGURATION:
      return `Configuration error. Please check your team-mapping.yaml file. ${originalMessage}`

    case ErrorCategory.NOT_FOUND:
      return `Resource not found. ${originalMessage}`

    default:
      return originalMessage
  }
}
