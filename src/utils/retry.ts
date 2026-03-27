/**
 * Retry utility with exponential backoff
 */

import * as core from '@actions/core'
import { sleep } from '../utils.js'
import { VeracodeActionError, isRetryable } from '../errors.js'

/**
 * Executes a function with exponential backoff retry logic
 * @param operation Function to execute
 * @param operationName Name of the operation for logging
 * @param maxRetries Maximum number of retry attempts
 * @returns Result of the operation
 * @throws Error if all retries are exhausted
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      return await operation()
    } catch (error) {
      attempt++

      const err = error as VeracodeActionError
      const shouldRetry =
        err.retryable || isRetryable(err.category, err.statusCode)

      if (!shouldRetry || attempt >= maxRetries) {
        core.error(
          `Operation failed after ${attempt} attempts: ${operationName}`
        )
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const backoffDelay = Math.pow(2, attempt) * 1000
      core.warning(
        `${operationName} failed (attempt ${attempt}/${maxRetries}). ` +
          `Retrying in ${backoffDelay}ms... Error: ${err.message}`
      )

      await sleep(backoffDelay)
    }
  }

  throw new Error(
    `Operation failed after ${maxRetries} retries: ${operationName}`
  )
}
