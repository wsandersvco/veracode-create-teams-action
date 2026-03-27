/**
 * Configuration Validator
 *
 * Uses Zod for schema validation of team mapping YAML configuration.
 */

import { z } from 'zod'
import type { TeamMapping } from '../types.js'

// Zod schema for team member
const TeamMemberSchema = z.object({
  user: z.string().min(1, 'User email/username is required'),
  relationship: z.enum(['ADMIN', 'MEMBER'], {
    errorMap: () => ({ message: 'Relationship must be either ADMIN or MEMBER' })
  })
})

// Zod schema for team configuration
const TeamConfigurationSchema = z.object({
  team_name: z
    .string()
    .min(1, 'Team name is required')
    .max(256, 'Team name must be 256 characters or less'),
  description: z.string().optional(),
  business_unit: z.string().optional(),
  member_only: z.boolean().optional(),
  members: z.array(TeamMemberSchema).default([]),
  sync_github_collaborators: z.boolean().optional(),
  github_collaborator_filter: z
    .array(z.enum(['admin', 'write', 'read']))
    .optional()
})

// Zod schema for default settings
const DefaultSettingsSchema = z.object({
  business_unit: z.string().optional(),
  member_only: z.boolean().optional(),
  auto_add_collaborators: z.boolean().optional(),
  incremental_updates: z.boolean().optional()
})

// Zod schema for fallback configuration
const FallbackConfigurationSchema = z.object({
  auto_create: z.boolean(),
  team_name_template: z.string().optional(),
  default_members: z.array(TeamMemberSchema).optional()
})

// Complete mapping schema
const TeamMappingSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  defaults: DefaultSettingsSchema.optional(),
  mappings: z.record(z.string(), TeamConfigurationSchema),
  fallback: FallbackConfigurationSchema.optional()
})

/**
 * Validates and parses team mapping configuration
 * @throws Error if validation fails
 */
export function validateMapping(rawMapping: unknown): TeamMapping {
  try {
    return TeamMappingSchema.parse(rawMapping) as TeamMapping
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ')
      throw new Error(`Invalid team mapping configuration: ${issues}`, {
        cause: error
      })
    }
    throw error
  }
}

/**
 * Validates team mapping and returns validation result without throwing
 */
export function safeValidateMapping(rawMapping: unknown): {
  success: boolean
  data?: TeamMapping
  error?: string
} {
  try {
    const data = validateMapping(rawMapping)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
