/**
 * User Validator Service
 *
 * CRITICAL: The Veracode API will fail if you attempt to add users that don't
 * exist in the platform. This service validates all users before team operations.
 */

import * as core from '@actions/core'
import { VeracodeClient } from '../veracode/client.js'
import type {
  TeamMember,
  UserValidationResult,
  InvalidMember,
  VeracodeUser
} from '../types.js'
import { normalizeEmail } from '../utils.js'

/**
 * Validates team members against Veracode platform
 */
export class UserValidator {
  private userCache = new Map<string, VeracodeUser | null>()

  constructor(private veracodeClient: VeracodeClient) {}

  /**
   * Validates all team members against Veracode platform
   */
  async validateTeamMembers(
    members: TeamMember[]
  ): Promise<UserValidationResult> {
    core.info(
      `Validating ${members.length} team members against Veracode platform...`
    )

    const validMembers: TeamMember[] = []
    const invalidMembers: InvalidMember[] = []

    for (const member of members) {
      const result = await this.validateUser(member.user)

      if (result.valid) {
        const veracodeUser = result.veracodeUser!
        let relationship = member.relationship

        // Check if user has Team Admin role when ADMIN relationship is requested
        if (relationship === 'ADMIN') {
          const hasTeamAdminRole = this.hasTeamAdminRole(veracodeUser)

          if (!hasTeamAdminRole) {
            core.warning(
              `User ${member.user} does not have the 'Team Admin' role. ` +
                `Downgrading relationship from ADMIN to MEMBER.`
            )
            relationship = 'MEMBER'
          }
        }

        validMembers.push({
          user: veracodeUser.user_name, // Use user_name, not email
          relationship
        })
        core.debug(`✓ Validated user: ${member.user}`)
      } else {
        invalidMembers.push({
          user: member.user,
          reason: result.reason
        })
        core.warning(`✗ Invalid user: ${member.user} - ${result.reason}`)
      }
    }

    // Log summary
    core.info('Validation complete:')
    core.info(`  ✓ Valid members: ${validMembers.length}`)
    core.info(`  ✗ Invalid members: ${invalidMembers.length}`)

    if (invalidMembers.length > 0) {
      core.warning(`${invalidMembers.length} users will be skipped:`)
      for (const invalid of invalidMembers) {
        core.warning(`  - ${invalid.user}: ${invalid.reason}`)
      }
    }

    return { validMembers, invalidMembers }
  }

  /**
   * Validates a single user
   */
  private async validateUser(emailOrUsername: string): Promise<{
    valid: boolean
    reason: string
    veracodeUser?: VeracodeUser
  }> {
    // Check cache first
    const cached = this.userCache.get(normalizeEmail(emailOrUsername))
    if (cached !== undefined) {
      if (cached === null) {
        return {
          valid: false,
          reason: 'User does not exist in Veracode platform'
        }
      }
      if (!cached.active) {
        return { valid: false, reason: 'User account is inactive' }
      }
      return { valid: true, reason: '', veracodeUser: cached }
    }

    // Search for user in Veracode
    try {
      core.debug(`Checking if user exists in Veracode: ${emailOrUsername}`)

      const response = await this.veracodeClient.getUsers({
        search_term: emailOrUsername,
        pageable: { page: 0, size: 50 }
      })

      // Find exact match
      const normalizedSearch = normalizeEmail(emailOrUsername)
      const user = response.users.find(
        (u) =>
          normalizeEmail(u.email_address) === normalizedSearch ||
          normalizeEmail(u.user_name) === normalizedSearch
      )

      if (!user) {
        core.debug(`User not found in Veracode: ${emailOrUsername}`)
        this.userCache.set(normalizedSearch, null)
        return {
          valid: false,
          reason: 'User does not exist in Veracode platform'
        }
      }

      // Cache the user
      this.userCache.set(normalizedSearch, user)

      // Check if user is active
      if (!user.active) {
        core.debug(`User is inactive: ${emailOrUsername}`)
        return { valid: false, reason: 'User account is inactive' }
      }

      core.debug(`Found user in Veracode: ${user.user_name} (${user.user_id})`)
      return { valid: true, reason: '', veracodeUser: user }
    } catch (error) {
      core.warning(`Error checking user existence: ${(error as Error).message}`)
      return {
        valid: false,
        reason: `Failed to validate user: ${(error as Error).message}`
      }
    }
  }

  /**
   * Checks if a user has the Team Admin role
   */
  private hasTeamAdminRole(user: VeracodeUser): boolean {
    if (!user.roles || user.roles.length === 0) {
      return false
    }

    // Check for Team Admin role by name
    // Common variations: 'teamadmin', 'team admin', 'Team Admin'
    return user.roles.some(
      (role) => role.role_name?.toLowerCase() === 'teamadmin'
    )
  }

  /**
   * Clears the user cache
   */
  clearCache(): void {
    this.userCache.clear()
  }

  /**
   * Gets the size of the user cache
   */
  getCacheSize(): number {
    return this.userCache.size
  }
}
