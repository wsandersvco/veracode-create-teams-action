/**
 * Unit tests for utility functions (src/utils.ts)
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import {
  normalizeEmail,
  isValidEmail,
  isValidTeamName,
  sleep,
  interpolateTemplate,
  chunk,
  safeStringify,
  safeJsonParse,
  isDefined,
  uniqueBy,
  sanitizeForLogging,
  formatList,
  isNonEmptyString,
  toTitleCase
} from '../src/utils.js'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

describe('utils.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com')
    })

    it('should trim whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com')
    })

    it('should handle already normalized email', () => {
      expect(normalizeEmail('user@example.com')).toBe('user@example.com')
    })

    it('should handle mixed case', () => {
      expect(normalizeEmail('UsEr@ExAmPlE.CoM')).toBe('user@example.com')
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('user.name@example.com')).toBe(true)
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
      expect(isValidEmail('user_name@example-domain.com')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('invalid@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('invalid@com')).toBe(false)
      expect(isValidEmail('invalid @example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isValidEmail('a@b.c')).toBe(true) // Minimal valid email
      expect(isValidEmail('user@@example.com')).toBe(false) // Double @
    })
  })

  describe('isValidTeamName', () => {
    it('should accept valid team names', () => {
      expect(isValidTeamName('My Team')).toBe(true)
      expect(isValidTeamName('A')).toBe(true) // Single character
      expect(isValidTeamName('a'.repeat(256))).toBe(true) // Max length
    })

    it('should reject invalid team names', () => {
      expect(isValidTeamName('')).toBe(false) // Empty
      expect(isValidTeamName('a'.repeat(257))).toBe(false) // Too long
    })

    it('should accept names with special characters', () => {
      expect(isValidTeamName('Team-123')).toBe(true)
      expect(isValidTeamName('Team_ABC')).toBe(true)
      expect(isValidTeamName('Team (Security)')).toBe(true)
    })
  })

  describe('sleep', () => {
    it('should resolve after specified duration', async () => {
      const start = Date.now()
      await sleep(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(95) // Allow small variance
      expect(elapsed).toBeLessThan(200)
    })

    it('should resolve immediately for zero duration', async () => {
      const start = Date.now()
      await sleep(0)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('interpolateTemplate', () => {
    it('should replace single variable', () => {
      const result = interpolateTemplate('{name} Team', { name: 'MyApp' })
      expect(result).toBe('MyApp Team')
    })

    it('should replace multiple variables', () => {
      const result = interpolateTemplate('{org}/{repo}', {
        org: 'myorg',
        repo: 'myrepo'
      })
      expect(result).toBe('myorg/myrepo')
    })

    it('should leave undefined variables unchanged', () => {
      const result = interpolateTemplate('{name} {other}', { name: 'Test' })
      expect(result).toBe('Test {other}')
    })

    it('should handle no variables', () => {
      const result = interpolateTemplate('No variables here', {})
      expect(result).toBe('No variables here')
    })

    it('should handle empty template', () => {
      const result = interpolateTemplate('', { name: 'Test' })
      expect(result).toBe('')
    })

    it('should handle duplicate variables', () => {
      const result = interpolateTemplate('{name}-{name}', { name: 'Test' })
      expect(result).toBe('Test-Test')
    })
  })

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const result = chunk([1, 2, 3, 4, 5], 2)
      expect(result).toEqual([[1, 2], [3, 4], [5]])
    })

    it('should handle exact division', () => {
      const result = chunk([1, 2, 3, 4], 2)
      expect(result).toEqual([
        [1, 2],
        [3, 4]
      ])
    })

    it('should handle empty array', () => {
      const result = chunk([], 2)
      expect(result).toEqual([])
    })

    it('should handle chunk size larger than array', () => {
      const result = chunk([1, 2], 5)
      expect(result).toEqual([[1, 2]])
    })

    it('should handle chunk size of 1', () => {
      const result = chunk([1, 2, 3], 1)
      expect(result).toEqual([[1], [2], [3]])
    })
  })

  describe('safeStringify', () => {
    it('should stringify objects', () => {
      const obj = { name: 'test', value: 123 }
      const result = safeStringify(obj)
      expect(result).toContain('"name"')
      expect(result).toContain('"test"')
      expect(result).toContain('"value"')
      expect(result).toContain('123')
    })

    it('should handle circular references', () => {
      const obj: { name: string; self?: unknown } = { name: 'test' }
      obj.self = obj
      const result = safeStringify(obj)
      expect(result).toBeTruthy() // Should not throw
      // Note: Circular reference handling logs a warning, but we can't easily test it
    })

    it('should use custom indentation', () => {
      const obj = { a: 1 }
      const result = safeStringify(obj, 4)
      expect(result).toContain('    ') // 4 spaces
    })

    it('should handle primitives', () => {
      expect(safeStringify('string')).toBe('"string"')
      expect(safeStringify(123)).toBe('123')
      expect(safeStringify(true)).toBe('true')
      expect(safeStringify(null)).toBe('null')
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse<{ name: string }>('{"name":"test"}')
      expect(result).toEqual({ name: 'test' })
    })

    it('should return null for invalid JSON', () => {
      const result = safeJsonParse('invalid json')
      expect(result).toBeNull()
      // Note: Invalid JSON handling logs a warning, but we can't easily test it
    })

    it('should handle empty string', () => {
      const result = safeJsonParse('')
      expect(result).toBeNull()
      // Note: Empty string parsing logs a warning, but we can't easily test it
    })

    it('should parse arrays', () => {
      const result = safeJsonParse<number[]>('[1,2,3]')
      expect(result).toEqual([1, 2, 3])
    })
  })

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true)
      expect(isDefined('')).toBe(true)
      expect(isDefined(false)).toBe(true)
      expect(isDefined([])).toBe(true)
      expect(isDefined({})).toBe(true)
    })

    it('should return false for null', () => {
      expect(isDefined(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isDefined(undefined)).toBe(false)
    })
  })

  describe('uniqueBy', () => {
    it('should remove duplicates by key function', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' }
      ]
      const result = uniqueBy(items, (item) => item.id)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('a')
      expect(result[1].name).toBe('b')
    })

    it('should handle empty array', () => {
      const result = uniqueBy([], (item) => item)
      expect(result).toEqual([])
    })

    it('should handle all unique items', () => {
      const items = [1, 2, 3, 4]
      const result = uniqueBy(items, (item) => item)
      expect(result).toEqual([1, 2, 3, 4])
    })

    it('should use string keys', () => {
      const items = ['apple', 'banana', 'apple', 'cherry']
      const result = uniqueBy(items, (item) => item)
      expect(result).toEqual(['apple', 'banana', 'cherry'])
    })
  })

  describe('sanitizeForLogging', () => {
    it('should redact email addresses', () => {
      const text = 'User: user@example.com contacted us'
      const result = sanitizeForLogging(text)
      expect(result).toContain('***@***.***')
      expect(result).not.toContain('user@example.com')
    })

    it('should redact multiple email addresses', () => {
      const text = 'From: user1@example.com to user2@example.org'
      const result = sanitizeForLogging(text)
      const emailCount = (result.match(/\*\*\*@\*\*\*\.\*\*\*/g) || []).length
      expect(emailCount).toBe(2)
    })

    it('should redact long alphanumeric strings (API keys)', () => {
      const text = 'API Key: abc123def456ghi789jkl012mno345pqr678'
      const result = sanitizeForLogging(text)
      expect(result).toContain('***REDACTED***')
      expect(result).not.toContain('abc123def456')
    })

    it('should preserve non-sensitive text', () => {
      const text = 'User logged in successfully'
      const result = sanitizeForLogging(text)
      expect(result).toBe(text)
    })
  })

  describe('formatList', () => {
    it('should format short lists', () => {
      const result = formatList(['item1', 'item2', 'item3'])
      expect(result).toBe('item1, item2, item3')
    })

    it('should truncate long lists', () => {
      const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      const result = formatList(items, 5)
      expect(result).toContain('a, b, c, d, e')
      expect(result).toContain('and 2 more')
      expect(result).not.toContain('f')
    })

    it('should handle empty list', () => {
      const result = formatList([])
      expect(result).toBe('none')
    })

    it('should handle single item', () => {
      const result = formatList(['item'])
      expect(result).toBe('item')
    })

    it('should use custom max items', () => {
      const items = ['a', 'b', 'c', 'd']
      const result = formatList(items, 2)
      expect(result).toContain('a, b')
      expect(result).toContain('and 2 more')
    })
  })

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true)
      expect(isNonEmptyString('   text   ')).toBe(true)
    })

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false)
      expect(isNonEmptyString('   ')).toBe(false)
    })

    it('should return false for non-strings', () => {
      expect(isNonEmptyString(123)).toBe(false)
      expect(isNonEmptyString(null)).toBe(false)
      expect(isNonEmptyString(undefined)).toBe(false)
      expect(isNonEmptyString([])).toBe(false)
      expect(isNonEmptyString({})).toBe(false)
    })
  })

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World')
    })

    it('should handle already title case', () => {
      expect(toTitleCase('Hello World')).toBe('Hello World')
    })

    it('should handle all uppercase', () => {
      expect(toTitleCase('HELLO WORLD')).toBe('Hello World')
    })

    it('should handle single word', () => {
      expect(toTitleCase('hello')).toBe('Hello')
    })

    it('should handle mixed case', () => {
      expect(toTitleCase('hELLo WoRLd')).toBe('Hello World')
    })

    it('should handle empty string', () => {
      expect(toTitleCase('')).toBe('')
    })
  })
})
