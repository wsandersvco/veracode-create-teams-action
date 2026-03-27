/**
 * Unit tests for error handling framework (src/errors.ts)
 */

import { describe, expect, it } from '@jest/globals'
import {
  ErrorCategory,
  VeracodeActionError,
  categorizeError,
  isRetryable,
  getUserFriendlyMessage
} from '../src/errors.js'

describe('errors.ts', () => {
  describe('VeracodeActionError', () => {
    it('should create an error with all properties', () => {
      const cause = new Error('Original error')
      const error = new VeracodeActionError(
        'Test error message',
        ErrorCategory.AUTHENTICATION,
        true,
        401,
        cause
      )

      expect(error.message).toBe('Test error message')
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION)
      expect(error.retryable).toBe(true)
      expect(error.statusCode).toBe(401)
      expect(error.cause).toBe(cause)
      expect(error.name).toBe('VeracodeActionError')
    })

    it('should create a non-retryable error by default', () => {
      const error = new VeracodeActionError(
        'Test error',
        ErrorCategory.VALIDATION
      )

      expect(error.retryable).toBe(false)
      expect(error.statusCode).toBeUndefined()
      expect(error.cause).toBeUndefined()
    })

    it('should be an instance of Error', () => {
      const error = new VeracodeActionError(
        'Test error',
        ErrorCategory.API_ERROR
      )

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(VeracodeActionError)
    })
  })

  describe('categorizeError', () => {
    it('should categorize 401 errors as AUTHENTICATION', () => {
      const error = { response: { status: 401 } }
      expect(categorizeError(error)).toBe(ErrorCategory.AUTHENTICATION)
    })

    it('should categorize 403 errors as AUTHORIZATION', () => {
      const error = { response: { status: 403 } }
      expect(categorizeError(error)).toBe(ErrorCategory.AUTHORIZATION)
    })

    it('should categorize 400 errors as VALIDATION', () => {
      const error = { response: { status: 400 } }
      expect(categorizeError(error)).toBe(ErrorCategory.VALIDATION)
    })

    it('should categorize 404 errors as NOT_FOUND', () => {
      const error = { response: { status: 404 } }
      expect(categorizeError(error)).toBe(ErrorCategory.NOT_FOUND)
    })

    it('should categorize 500 errors as API_ERROR', () => {
      const error = { response: { status: 500 } }
      expect(categorizeError(error)).toBe(ErrorCategory.API_ERROR)
    })

    it('should categorize 502 errors as API_ERROR', () => {
      const error = { response: { status: 502 } }
      expect(categorizeError(error)).toBe(ErrorCategory.API_ERROR)
    })

    it('should categorize 503 errors as API_ERROR', () => {
      const error = { response: { status: 503 } }
      expect(categorizeError(error)).toBe(ErrorCategory.API_ERROR)
    })

    it('should categorize ECONNREFUSED as NETWORK', () => {
      const error = { code: 'ECONNREFUSED' }
      expect(categorizeError(error)).toBe(ErrorCategory.NETWORK)
    })

    it('should categorize ETIMEDOUT as NETWORK', () => {
      const error = { code: 'ETIMEDOUT' }
      expect(categorizeError(error)).toBe(ErrorCategory.NETWORK)
    })

    it('should categorize ENOTFOUND as NETWORK', () => {
      const error = { code: 'ENOTFOUND' }
      expect(categorizeError(error)).toBe(ErrorCategory.NETWORK)
    })

    it('should categorize ENETUNREACH as NETWORK', () => {
      const error = { code: 'ENETUNREACH' }
      expect(categorizeError(error)).toBe(ErrorCategory.NETWORK)
    })

    it('should return existing category for VeracodeActionError', () => {
      const error = new VeracodeActionError('Test', ErrorCategory.AUTHORIZATION)
      expect(categorizeError(error)).toBe(ErrorCategory.AUTHORIZATION)
    })

    it('should categorize unknown errors as CONFIGURATION', () => {
      const error = new Error('Unknown error')
      expect(categorizeError(error)).toBe(ErrorCategory.CONFIGURATION)
    })

    it('should handle errors without response or code', () => {
      const error = { message: 'Some error' }
      expect(categorizeError(error)).toBe(ErrorCategory.CONFIGURATION)
    })
  })

  describe('isRetryable', () => {
    it('should return true for NETWORK errors', () => {
      expect(isRetryable(ErrorCategory.NETWORK)).toBe(true)
    })

    it('should return true for 500 status codes', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 500)).toBe(true)
    })

    it('should return true for 502 status codes', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 502)).toBe(true)
    })

    it('should return true for 503 status codes', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 503)).toBe(true)
    })

    it('should return true for 504 status codes', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 504)).toBe(true)
    })

    it('should return true for 429 status codes (rate limiting)', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 429)).toBe(true)
    })

    it('should return false for AUTHENTICATION errors', () => {
      expect(isRetryable(ErrorCategory.AUTHENTICATION, 401)).toBe(false)
    })

    it('should return false for AUTHORIZATION errors', () => {
      expect(isRetryable(ErrorCategory.AUTHORIZATION, 403)).toBe(false)
    })

    it('should return false for VALIDATION errors', () => {
      expect(isRetryable(ErrorCategory.VALIDATION, 400)).toBe(false)
    })

    it('should return false for CONFIGURATION errors', () => {
      expect(isRetryable(ErrorCategory.CONFIGURATION)).toBe(false)
    })

    it('should return false for API_ERROR with non-retryable status code', () => {
      expect(isRetryable(ErrorCategory.API_ERROR, 400)).toBe(false)
    })

    it('should return false for API_ERROR without status code', () => {
      expect(isRetryable(ErrorCategory.API_ERROR)).toBe(false)
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return friendly message for AUTHENTICATION error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.AUTHENTICATION,
        'Invalid credentials'
      )
      expect(message).toContain('Authentication failed')
      expect(message).toContain('Veracode API credentials')
      expect(message).toContain('Invalid credentials')
    })

    it('should return friendly message for AUTHORIZATION error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.AUTHORIZATION,
        'Access denied'
      )
      expect(message).toContain('Authorization failed')
      expect(message).toContain('Team Admin permissions')
      expect(message).toContain('Access denied')
    })

    it('should return friendly message for VALIDATION error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.VALIDATION,
        'Invalid input'
      )
      expect(message).toContain('Validation error')
      expect(message).toContain('input parameters')
      expect(message).toContain('Invalid input')
    })

    it('should return friendly message for API_ERROR', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.API_ERROR,
        'Service unavailable'
      )
      expect(message).toContain('Veracode API error')
      expect(message).toContain('temporarily unavailable')
      expect(message).toContain('Service unavailable')
    })

    it('should return friendly message for NETWORK error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.NETWORK,
        'Connection timeout'
      )
      expect(message).toContain('Network error')
      expect(message).toContain('check your connection')
      expect(message).toContain('Connection timeout')
    })

    it('should return friendly message for CONFIGURATION error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.CONFIGURATION,
        'Invalid YAML'
      )
      expect(message).toContain('Configuration error')
      expect(message).toContain('team-mapping.yaml')
      expect(message).toContain('Invalid YAML')
    })

    it('should return friendly message for NOT_FOUND error', () => {
      const message = getUserFriendlyMessage(
        ErrorCategory.NOT_FOUND,
        'Team not found'
      )
      expect(message).toContain('Resource not found')
      expect(message).toContain('Team not found')
    })

    it('should return original message for unknown category', () => {
      const message = getUserFriendlyMessage(
        'UNKNOWN' as ErrorCategory,
        'Original message'
      )
      expect(message).toBe('Original message')
    })
  })
})
