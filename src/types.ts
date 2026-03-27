/**
 * Type definitions for Veracode Create Teams Action
 */

/**
 * Configuration for a team in Veracode
 */
export interface TeamConfiguration {
  team_name: string
  description?: string
  business_unit?: string
  member_only?: boolean
  members: TeamMember[]
  sync_github_collaborators?: boolean
  github_collaborator_filter?: ('admin' | 'write' | 'read')[]
}

/**
 * Team member with role
 */
export interface TeamMember {
  user: string // Email or username
  relationship: 'ADMIN' | 'MEMBER'
}

/**
 * Complete team mapping schema
 */
export interface TeamMapping {
  version: string
  defaults?: DefaultSettings
  mappings: Record<string, TeamConfiguration>
  fallback?: FallbackConfiguration
}

/**
 * Default settings applied to all teams
 */
export interface DefaultSettings {
  business_unit?: string
  member_only?: boolean
  auto_add_collaborators?: boolean
  incremental_updates?: boolean
}

/**
 * Fallback configuration when no mapping matches
 */
export interface FallbackConfiguration {
  auto_create: boolean
  team_name_template?: string
  default_members?: TeamMember[]
}

/**
 * Veracode API team response
 */
export interface VeracodeTeam {
  team_id: string
  team_name: string
  team_legacy_id: number
  user_count?: number
  business_unit?: {
    bu_id: string
    bu_name: string
  }
  users?: VeracodeUser[]
  insert_ts?: string
  modify_ts?: string
}

/**
 * Veracode API user response
 */
export interface VeracodeUser {
  user_id: string
  user_name: string
  email_address: string
  first_name?: string
  last_name?: string
  active: boolean
  login_enabled: boolean
  account_type: string
  roles?: Array<{
    role_id: string
    role_name: string
  }>
}

/**
 * User validation result
 */
export interface UserValidationResult {
  validMembers: TeamMember[]
  invalidMembers: InvalidMember[]
}

/**
 * Invalid member with reason
 */
export interface InvalidMember {
  user: string
  reason: string
}

/**
 * Action inputs
 */
export interface ActionInputs {
  githubToken: string
  veracodeApiId: string
  veracodeApiKey: string
  repository: string
  owner: string
  configRepository: string
  configRef?: string
  mappingPath: string
  veracodeRegion: 'US' | 'EU' | 'FEDERAL'
}

/**
 * Action outputs
 */
export interface ActionOutputs {
  teamId: string
  teamName: string
  teamLegacyId: number
  actionTaken: 'created' | 'updated'
  memberCount: number
  membersAdded: number
  membersSkipped: number
  skippedUsers: string[]
}

/**
 * Pagination parameters for Veracode API
 */
export interface Pageable {
  page: number
  size: number
}

/**
 * Veracode API paginated response
 */
export interface PaginatedResponse<T> {
  _embedded?: {
    [key: string]: T[]
  }
  page: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}
