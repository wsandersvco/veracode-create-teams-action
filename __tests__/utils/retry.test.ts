/**
 * Unit tests for retry utility
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../../src/utils.js', () => ({
  sleep: jest.fn().mockResolvedValue(undefined)
}))

// Import after mocking
const { executeWithRetry } = await import('../../src/utils/retry.js')
const { sleep } = await import('../../src/utils.js')
const { VeracodeActionError, ErrorCategory } =
  await import('../../src/errors.js')

describe('utils/retry.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await executeWithRetry(mockOperation, 'Test Operation')

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('should retry on retryable error', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(
          new VeracodeActionError('Network error', ErrorCategory.NETWORK, true)
        )
        .mockResolvedValueOnce('success')

      const result = await executeWithRetry(mockOperation, 'Test Operation')

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenCalledTimes(1)
      expect(sleep).toHaveBeenCalledWith(2000) // 2^1 * 1000
    })

    it('should retry multiple times with exponential backoff', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(
          new VeracodeActionError('Error 1', ErrorCategory.NETWORK, true)
        )
        .mockRejectedValueOnce(
          new VeracodeActionError('Error 2', ErrorCategory.NETWORK, true)
        )
        .mockResolvedValueOnce('success')

      const result = await executeWithRetry(mockOperation, 'Test Operation')

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(3)
      expect(sleep).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenNthCalledWith(1, 2000) // 2^1 * 1000
      expect(sleep).toHaveBeenNthCalledWith(2, 4000) // 2^2 * 1000
    })

    it('should not retry non-retryable errors', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(
          new VeracodeActionError(
            'Authentication failed',
            ErrorCategory.AUTHENTICATION,
            false
          )
        )

      await expect(
        executeWithRetry(mockOperation, 'Test Operation')
      ).rejects.toThrow('Authentication failed')

      expect(mockOperation).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('should throw after max retries', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(
          new VeracodeActionError('Network error', ErrorCategory.NETWORK, true)
        )

      await expect(
        executeWithRetry(mockOperation, 'Test Operation', 3)
      ).rejects.toThrow('Network error')

      expect(mockOperation).toHaveBeenCalledTimes(3)
      expect(sleep).toHaveBeenCalledTimes(2)
      expect(core.error).toHaveBeenCalledWith(
        'Operation failed after 3 attempts: Test Operation'
      )
    })

    it('should log warning on retry', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(
          new VeracodeActionError(
            'Temporary error',
            ErrorCategory.NETWORK,
            true
          )
        )
        .mockResolvedValueOnce('success')

      await executeWithRetry(mockOperation, 'Test Operation')

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Test Operation failed')
      )
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('attempt 1/3')
      )
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Retrying in 2000ms')
      )
    })

    it('should handle custom max retries', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(
          new VeracodeActionError('Error', ErrorCategory.NETWORK, true)
        )

      await expect(
        executeWithRetry(mockOperation, 'Test Operation', 5)
      ).rejects.toThrow()

      expect(mockOperation).toHaveBeenCalledTimes(5)
      expect(sleep).toHaveBeenCalledTimes(4)
    })

    it('should retry on 500 error even if not explicitly retryable', async () => {
      const error500 = new VeracodeActionError(
        'Server error',
        ErrorCategory.API_ERROR,
        false,
        500
      )

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce('success')

      const result = await executeWithRetry(mockOperation, 'Test Operation')

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })
  })
})
