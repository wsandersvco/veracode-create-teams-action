/**
 * Utility functions for Veracode Create Teams Action
 */

import * as core from '@actions/core'

/**
 * Normalizes an email address to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Validates an email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validates a team name according to Veracode requirements
 * Team names: 1-256 characters, alphanumeric with spaces/dashes
 */
export function isValidTeamName(name: string): boolean {
  return name.length > 0 && name.length <= 256
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Interpolates template variables in a string
 * @example interpolateTemplate("{repository_name} Team", {repository_name: "my-app"}) => "my-app Team"
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] || match
  })
}

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(obj, null, indent)
  } catch (error) {
    core.warning(`Failed to stringify object: ${(error as Error).message}`)
    return String(obj)
  }
}

/**
 * Safely parses a JSON string
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    core.warning(`Failed to parse JSON: ${(error as Error).message}`)
    return null
  }
}

/**
 * Checks if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Removes duplicate items from an array based on a key function
 */
export function uniqueBy<T>(
  array: T[],
  keyFn: (item: T) => string | number
): T[] {
  const seen = new Set<string | number>()
  return array.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Sanitizes a string for logging (removes sensitive information)
 */
export function sanitizeForLogging(text: string): string {
  // Remove email addresses
  let sanitized = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '***@***.***'
  )

  // Remove potential API keys/tokens (long alphanumeric strings)
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '***REDACTED***')

  return sanitized
}

/**
 * Formats a list of items for display
 */
export function formatList(items: string[], maxItems: number = 5): string {
  if (items.length === 0) {
    return 'none'
  }

  if (items.length <= maxItems) {
    return items.join(', ')
  }

  const displayed = items.slice(0, maxItems)
  const remaining = items.length - maxItems
  return `${displayed.join(', ')} ... and ${remaining} more`
}

/**
 * Validates that a string is not empty after trimming
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Converts a string to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}
