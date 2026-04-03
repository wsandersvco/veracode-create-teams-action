/**
 * Utility functions for Veracode Create Teams Action
 */

/**
 * Normalizes an email address to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Delays execution for a specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
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
 * Sanitizes log output to prevent log injection attacks (CWE-117)
 * Uses JSON.stringify to escape control characters including newlines and carriage returns
 * @param input - The string to sanitize
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLog(input: string | undefined | null): string {
  if (input === null || input === undefined || input === '') {
    return ''
  }

  // JSON.stringify escapes all control characters including \n, \r, \t, etc.
  // Remove the outer quotes for cleaner log output
  const stringified = JSON.stringify(String(input))
  return stringified.slice(1, -1)
}
