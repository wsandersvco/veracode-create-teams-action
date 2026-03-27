/**
 * Rate limiter for API calls
 */

import { sleep } from '../utils.js'

/**
 * Rate limiter that controls the rate of API calls to prevent overwhelming the API
 * or hitting rate limits. Supports both concurrent request limits and minimum
 * intervals between requests.
 */
export class RateLimiter {
  private requestQueue: Promise<unknown>[] = []
  private readonly maxConcurrent: number
  private readonly minInterval: number

  /**
   * Creates a new rate limiter
   * @param maxConcurrent Maximum number of concurrent requests (default: 5)
   * @param minIntervalMs Minimum interval between requests in milliseconds (default: 200)
   */
  constructor(maxConcurrent: number = 5, minIntervalMs: number = 200) {
    this.maxConcurrent = maxConcurrent
    this.minInterval = minIntervalMs
  }

  /**
   * Throttles execution of an async function according to rate limiting rules
   * @param fn Function to execute
   * @returns Promise that resolves with the result of the function
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    // Wait if too many concurrent requests
    while (this.requestQueue.length >= this.maxConcurrent) {
      // Use catch to prevent unhandled rejections in race
      await Promise.race(this.requestQueue.map((p) => p.catch(() => undefined)))
    }

    // Execute with minimum interval
    const promise = this.executeWithDelay(fn)

    // Create a wrapped promise that handles cleanup
    const wrappedPromise = promise.then(
      (result) => {
        this.removeFromQueue(wrappedPromise)
        return result
      },
      (error) => {
        this.removeFromQueue(wrappedPromise)
        throw error
      }
    )

    this.requestQueue.push(wrappedPromise)

    return wrappedPromise
  }

  /**
   * Removes a promise from the request queue
   * @param promise Promise to remove
   */
  private removeFromQueue(promise: Promise<unknown>): void {
    this.requestQueue = this.requestQueue.filter((p) => p !== promise)
  }

  /**
   * Executes function with delay
   * @param fn Function to execute
   * @returns Promise that resolves with the result after minimum interval
   */
  private async executeWithDelay<T>(fn: () => Promise<T>): Promise<T> {
    await sleep(this.minInterval)
    return fn()
  }

  /**
   * Gets the current number of pending requests
   * @returns Number of requests currently in the queue
   */
  get pendingRequests(): number {
    return this.requestQueue.length
  }

  /**
   * Clears all pending requests (for cleanup/testing)
   */
  clear(): void {
    this.requestQueue = []
  }
}
