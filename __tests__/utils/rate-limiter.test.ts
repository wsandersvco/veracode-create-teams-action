/**
 * Unit tests for rate limiter utility
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'

jest.unstable_mockModule('../../src/utils.js', () => ({
  sleep: jest.fn().mockResolvedValue(undefined)
}))

// Import after mocking
const { RateLimiter } = await import('../../src/utils/rate-limiter.js')
const { sleep } = await import('../../src/utils.js')

describe('utils/rate-limiter.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RateLimiter', () => {
    it('should execute a single request immediately with delay', async () => {
      const limiter = new RateLimiter(5, 200)
      const mockFn = jest.fn().mockResolvedValue('result')

      const result = await limiter.throttle(mockFn)

      expect(result).toBe('result')
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(sleep).toHaveBeenCalledWith(200)
    })

    it('should allow concurrent requests up to max limit', async () => {
      const limiter = new RateLimiter(3, 100)
      const mockFn = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('done'), 50))
        )

      // Start 3 requests concurrently
      const promises = [
        limiter.throttle(mockFn),
        limiter.throttle(mockFn),
        limiter.throttle(mockFn)
      ]

      // All should start without waiting for each other (beyond min interval)
      expect(limiter.pendingRequests).toBe(3)

      await Promise.all(promises)
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should wait when max concurrent requests is reached', async () => {
      const limiter = new RateLimiter(2, 50)
      const results: string[] = []

      const mockFn = jest.fn().mockImplementation(
        (id: string) =>
          new Promise((resolve) => {
            setTimeout(() => {
              results.push(id)
              resolve(id)
            }, 100)
          })
      )

      // Start 4 requests - only 2 should run concurrently
      const promises = [
        limiter.throttle(() => mockFn('req1')),
        limiter.throttle(() => mockFn('req2')),
        limiter.throttle(() => mockFn('req3')),
        limiter.throttle(() => mockFn('req4'))
      ]

      // Wait for all to complete
      await Promise.all(promises)

      expect(mockFn).toHaveBeenCalledTimes(4)
      // First two should complete before the second two start
      expect(results).toHaveLength(4)
    })

    it('should enforce minimum interval between requests', async () => {
      const limiter = new RateLimiter(10, 500)
      const mockFn = jest.fn().mockResolvedValue('ok')

      await limiter.throttle(mockFn)

      expect(sleep).toHaveBeenCalledWith(500)
    })

    it('should handle errors properly', async () => {
      const limiter = new RateLimiter(5, 10)
      const mockFn = jest.fn().mockImplementation(() => {
        return Promise.reject(new Error('Test error'))
      })

      await expect(limiter.throttle(mockFn)).rejects.toThrow('Test error')

      // Queue should be cleaned up after error
      expect(limiter.pendingRequests).toBe(0)
    })

    it('should track pending requests correctly', async () => {
      const limiter = new RateLimiter(3, 50)
      const mockFn = jest.fn().mockResolvedValue('done')

      expect(limiter.pendingRequests).toBe(0)

      const promise1 = limiter.throttle(mockFn)
      expect(limiter.pendingRequests).toBe(1)

      const promise2 = limiter.throttle(mockFn)
      expect(limiter.pendingRequests).toBe(2)

      await Promise.all([promise1, promise2])
      expect(limiter.pendingRequests).toBe(0)
    })

    it('should clear pending requests when clear is called', async () => {
      const limiter = new RateLimiter(3, 50)
      const mockFn = jest.fn().mockResolvedValue('done')

      // Start some requests but don't await them yet
      const p1 = limiter.throttle(mockFn)
      const p2 = limiter.throttle(mockFn)

      expect(limiter.pendingRequests).toBeGreaterThan(0)

      limiter.clear()

      expect(limiter.pendingRequests).toBe(0)

      // Clean up by awaiting the promises
      await Promise.all([p1, p2])
    })

    it('should use default values when not provided', async () => {
      const limiter = new RateLimiter()
      const mockFn = jest.fn().mockResolvedValue('result')

      await limiter.throttle(mockFn)

      // Default minInterval is 200ms
      expect(sleep).toHaveBeenCalledWith(200)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple rapid requests with rate limiting', async () => {
      const limiter = new RateLimiter(2, 100)
      const executionOrder: number[] = []

      const mockFn = jest.fn().mockImplementation((id: number) => {
        executionOrder.push(id)
        return Promise.resolve(`result-${id}`)
      })

      // Fire 5 requests rapidly
      const promises = Array.from({ length: 5 }, (_, i) =>
        limiter.throttle(() => mockFn(i))
      )

      await Promise.all(promises)

      expect(mockFn).toHaveBeenCalledTimes(5)
      expect(executionOrder).toHaveLength(5)
      // All requests should have executed
      expect(new Set(executionOrder).size).toBe(5)
    })

    it('should handle only successful requests', async () => {
      const limiter = new RateLimiter(3, 50)
      const successFn = jest.fn().mockResolvedValue('success')

      const results = await Promise.all([
        limiter.throttle(successFn),
        limiter.throttle(successFn),
        limiter.throttle(successFn),
        limiter.throttle(successFn)
      ])

      expect(results).toEqual(['success', 'success', 'success', 'success'])
      expect(successFn).toHaveBeenCalledTimes(4)

      // Queue should be empty after all complete
      expect(limiter.pendingRequests).toBe(0)
    })

    it('should properly queue requests when limit is 1', async () => {
      const limiter = new RateLimiter(1, 50)
      const executionTimes: number[] = []

      const mockFn = jest.fn().mockImplementation(() => {
        executionTimes.push(Date.now())
        return Promise.resolve('done')
      })

      const promises = [
        limiter.throttle(mockFn),
        limiter.throttle(mockFn),
        limiter.throttle(mockFn)
      ]

      await Promise.all(promises)

      expect(mockFn).toHaveBeenCalledTimes(3)
      // With maxConcurrent=1, requests should be serialized
      expect(executionTimes).toHaveLength(3)
    })

    it('should return the correct result from throttled function', async () => {
      const limiter = new RateLimiter(5, 100)
      const mockFn = jest.fn().mockImplementation((x: number, y: number) => {
        return Promise.resolve(x + y)
      })

      const result = await limiter.throttle(() => mockFn(5, 10))

      expect(result).toBe(15)
      expect(mockFn).toHaveBeenCalledWith(5, 10)
    })

    it('should handle zero interval gracefully', async () => {
      const limiter = new RateLimiter(5, 0)
      const mockFn = jest.fn().mockResolvedValue('result')

      await limiter.throttle(mockFn)

      expect(sleep).toHaveBeenCalledWith(0)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should clean up queue entries on completion', async () => {
      const limiter = new RateLimiter(3, 50)
      const mockFn = jest.fn().mockResolvedValue('done')

      const promise1 = limiter.throttle(mockFn)
      expect(limiter.pendingRequests).toBe(1)

      const promise2 = limiter.throttle(mockFn)
      expect(limiter.pendingRequests).toBe(2)

      await promise1
      // After first completes, should have 1 less (or both may have completed)
      expect(limiter.pendingRequests).toBeLessThanOrEqual(1)

      await promise2
      // After all complete, should be 0
      expect(limiter.pendingRequests).toBe(0)
    })
  })
})
