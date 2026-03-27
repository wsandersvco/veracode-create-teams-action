/**
 * Veracode API authentication using HMAC-SHA256
 */

import * as crypto from 'crypto'

/**
 * Computes HMAC-SHA256 and returns hex string
 */
function computeHashHex(message: string, keyHex: string): string {
  const hmac = crypto.createHmac('sha256', Buffer.from(keyHex, 'hex'))
  hmac.update(message)
  return hmac.digest('hex')
}

/**
 * Converts string to hex representation of its UTF-8 bytes
 */
function toHexBinary(input: string): string {
  return Buffer.from(input, 'utf8').toString('hex')
}

/**
 * Calculates the data signature using Veracode's key derivation process
 */
function calculateDataSignature(
  apiKeyHex: string,
  nonceHex: string,
  dateStamp: string,
  data: string
): string {
  const requestVersion = 'vcode_request_version_1'

  // Key derivation chain: apiKey -> nonce -> date -> version -> data
  const kNonce = computeHashHex(nonceHex, apiKeyHex)
  const kDate = computeHashHex(dateStamp, kNonce)
  const kSig = computeHashHex(requestVersion, kDate)
  const kFinal = computeHashHex(data, kSig)

  return kFinal
}

/**
 * Generates HMAC-SHA256 signature for Veracode API authentication
 * @param apiId - Veracode API ID
 * @param apiKey - Veracode API Key (hex string)
 * @param urlPath - API endpoint path (e.g., '/v2/teams')
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param host - API host (e.g., 'api.veracode.com', 'api.veracode.eu')
 * @returns Authorization header value
 */
export function generateAuthHeader(
  apiId: string,
  apiKey: string,
  urlPath: string,
  method: string = 'GET',
  host: string = 'api.veracode.com'
): string {
  // Generate nonce as uppercase hex (32 characters = 16 bytes)
  const nonceBytes = crypto.randomBytes(16).toString('hex').toUpperCase()
  const timestamp = Date.now().toString()

  // Construct the data string
  const data = `id=${apiId}&host=${host}&url=${urlPath}&method=${method}`

  // Calculate signature using key derivation process
  const dataSignature = calculateDataSignature(
    apiKey,
    nonceBytes,
    timestamp,
    data
  )

  // Convert nonce bytes (uppercase hex string) to hex binary representation
  const nonceHex = toHexBinary(nonceBytes)

  // Construct authorization header
  return `VERACODE-HMAC-SHA-256 id=${apiId},ts=${timestamp},nonce=${nonceHex},sig=${dataSignature}`
}

/**
 * Gets the base URL for the specified Veracode region
 * @param region - Veracode region (US, EU, or FEDERAL)
 * @returns Base URL for the Veracode Identity API
 */
export function getBaseUrl(region: 'US' | 'EU' | 'FEDERAL'): string {
  const baseUrls: Record<'US' | 'EU' | 'FEDERAL', string> = {
    US: 'https://api.veracode.com/api/authn',
    EU: 'https://api.veracode.eu/api/authn',
    FEDERAL: 'https://api.fed.veracode.us/api/authn'
  }
  return baseUrls[region]
}

/**
 * Validates that API credentials are in the correct format
 * @param apiId - API ID to validate
 * @param apiKey - API Key to validate (should be hex string)
 * @returns true if credentials appear valid
 */
export function validateCredentials(apiId: string, apiKey: string): boolean {
  // API ID should not be empty
  if (!apiId || apiId.trim().length === 0) {
    return false
  }

  // API Key should be a valid hex string (even length, only hex characters)
  if (!apiKey || apiKey.trim().length === 0) {
    return false
  }

  // Check if API key is a valid hex string
  const hexRegex = /^[0-9a-fA-F]+$/
  if (!hexRegex.test(apiKey) || apiKey.length % 2 !== 0) {
    return false
  }

  return true
}
