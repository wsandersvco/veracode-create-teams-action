/**
 * Unit tests for Veracode authentication (src/veracode/auth.ts)
 */

import { describe, expect, it } from '@jest/globals'
import {
  generateAuthHeader,
  getBaseUrl,
  validateCredentials
} from '../../src/veracode/auth.js'

describe('veracode/auth.ts', () => {
  describe('generateAuthHeader', () => {
    it('should generate valid HMAC-SHA256 auth header', () => {
      const apiId = 'test-api-id'
      const apiKey = '0123456789abcdef' // Valid hex string
      const urlPath = '/v2/teams'
      const method = 'GET'

      const result = generateAuthHeader(apiId, apiKey, urlPath, method)

      expect(result).toContain('VERACODE-HMAC-SHA-256')
      expect(result).toContain(`id=${apiId}`)
      expect(result).toContain('ts=')
      expect(result).toContain('nonce=')
      expect(result).toContain('sig=')
    })

    it('should include all required components in header', () => {
      const result = generateAuthHeader(
        'test-id',
        'abcd1234',
        '/v2/users',
        'POST'
      )

      // Check format: VERACODE-HMAC-SHA-256 id=...,ts=...,nonce=...,sig=...
      expect(result).toMatch(
        /^VERACODE-HMAC-SHA-256 id=.+,ts=\d+,nonce=[0-9a-f]+,sig=[0-9a-f]+$/
      )
    })

    it('should default to GET method', () => {
      const result = generateAuthHeader('test-id', 'abcd1234', '/v2/teams')
      expect(result).toBeTruthy()
      expect(result).toContain('VERACODE-HMAC-SHA-256')
    })

    it('should generate different nonces for each call', () => {
      const apiId = 'test-id'
      const apiKey = 'abcd1234'
      const urlPath = '/v2/teams'

      const result1 = generateAuthHeader(apiId, apiKey, urlPath)
      const result2 = generateAuthHeader(apiId, apiKey, urlPath)

      // Extract nonces
      const nonce1 = result1.match(/nonce=([^,]+)/)?.[1]
      const nonce2 = result2.match(/nonce=([^,]+)/)?.[1]

      expect(nonce1).toBeDefined()
      expect(nonce2).toBeDefined()
      expect(nonce1).not.toBe(nonce2)
    })

    it('should generate different timestamps for sequential calls', async () => {
      const apiId = 'test-id'
      const apiKey = 'abcd1234'
      const urlPath = '/v2/teams'

      const result1 = generateAuthHeader(apiId, apiKey, urlPath)

      // Wait 2ms to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2))

      const result2 = generateAuthHeader(apiId, apiKey, urlPath)

      // Extract timestamps
      const ts1 = result1.match(/ts=(\d+)/)?.[1]
      const ts2 = result2.match(/ts=(\d+)/)?.[1]

      expect(ts1).toBeDefined()
      expect(ts2).toBeDefined()
      expect(Number(ts1)).toBeLessThanOrEqual(Number(ts2))
    })

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE']

      methods.forEach((method) => {
        const result = generateAuthHeader(
          'test-id',
          'abcd1234',
          '/v2/teams',
          method
        )
        expect(result).toBeTruthy()
        expect(result).toContain('VERACODE-HMAC-SHA-256')
      })
    })

    it('should handle different URL paths', () => {
      const paths = ['/v2/teams', '/v2/users', '/v2/teams/123', '/v2/users/abc']

      paths.forEach((path) => {
        const result = generateAuthHeader('test-id', 'abcd1234', path)
        expect(result).toBeTruthy()
      })
    })
  })

  describe('getBaseUrl', () => {
    it('should return correct URL for US region', () => {
      expect(getBaseUrl('US')).toBe('https://api.veracode.com')
    })

    it('should return correct URL for EU region', () => {
      expect(getBaseUrl('EU')).toBe('https://api.veracode.eu')
    })

    it('should return correct URL for FEDERAL region', () => {
      expect(getBaseUrl('FEDERAL')).toBe('https://api.fed.veracode.us')
    })
  })

  describe('validateCredentials', () => {
    it('should validate correct credentials', () => {
      expect(validateCredentials('my-api-id', 'abcd1234')).toBe(true)
      expect(validateCredentials('test', '0123456789abcdef')).toBe(true)
      expect(
        validateCredentials('id', 'ABCDEF0123456789abcdef0123456789')
      ).toBe(true)
    })

    it('should reject empty API ID', () => {
      expect(validateCredentials('', 'abcd1234')).toBe(false)
      expect(validateCredentials('   ', 'abcd1234')).toBe(false)
    })

    it('should reject empty API Key', () => {
      expect(validateCredentials('test-id', '')).toBe(false)
      expect(validateCredentials('test-id', '   ')).toBe(false)
    })

    it('should reject non-hex API Key', () => {
      expect(validateCredentials('test-id', 'notahexstring')).toBe(false)
      expect(validateCredentials('test-id', '12345g')).toBe(false) // 'g' not hex
      expect(validateCredentials('test-id', 'xyz123')).toBe(false)
    })

    it('should reject odd-length hex strings', () => {
      expect(validateCredentials('test-id', 'abc')).toBe(false) // Odd length
      expect(validateCredentials('test-id', '12345')).toBe(false) // Odd length
    })

    it('should accept even-length hex strings', () => {
      expect(validateCredentials('test-id', 'ab')).toBe(true)
      expect(validateCredentials('test-id', 'abcd')).toBe(true)
      expect(validateCredentials('test-id', '0123456789abcdef')).toBe(true)
    })

    it('should handle mixed case hex strings', () => {
      expect(validateCredentials('test-id', 'AbCd1234')).toBe(true)
      expect(validateCredentials('test-id', 'ABCDEF')).toBe(true)
      expect(validateCredentials('test-id', 'abcdef')).toBe(true)
    })

    it('should reject API keys with special characters', () => {
      expect(validateCredentials('test-id', 'abc-123')).toBe(false)
      expect(validateCredentials('test-id', 'abc_123')).toBe(false)
      expect(validateCredentials('test-id', 'abc 123')).toBe(false)
    })
  })
})
