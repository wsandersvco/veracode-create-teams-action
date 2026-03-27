/**
 * Configuration Resolver
 *
 * Resolves team configuration for repositories based on mappings,
 * wildcard patterns, and fallback rules.
 */

import * as core from '@actions/core'
import type {
  TeamMapping,
  TeamConfiguration,
  DefaultSettings
} from '../types.js'
import { interpolateTemplate } from '../utils.js'

/**
 * Resolves team configuration for a given repository
 */
export class ConfigurationResolver {
  constructor(private mapping: TeamMapping) {}

  /**
   * Resolves team configuration for a repository
   * @throws Error if no configuration found and no fallback
   */
  resolveTeamConfiguration(repository: string): TeamConfiguration {
    core.info(`Resolving team configuration for repository: ${repository}`)

    // 1. Check for exact repository match
    if (this.mapping.mappings[repository]) {
      core.info(`Found exact match in mappings`)
      return this.buildTeamConfig(
        this.mapping.mappings[repository],
        this.mapping.defaults
      )
    }

    // 2. Check for wildcard pattern matches
    for (const [pattern, config] of Object.entries(this.mapping.mappings)) {
      if (this.matchesWildcardPattern(repository, pattern)) {
        core.info(`Matched wildcard pattern: ${pattern}`)
        return this.buildTeamConfig(config, this.mapping.defaults)
      }
    }

    // 3. Use fallback configuration
    if (this.mapping.fallback?.auto_create) {
      core.info(`Using fallback auto-create configuration`)

      const teamName = this.mapping.fallback.team_name_template
        ? interpolateTemplate(this.mapping.fallback.team_name_template, {
            repository_name: repository,
            repository
          })
        : `${repository} Security Team`

      return {
        team_name: teamName,
        members: this.mapping.fallback.default_members || [],
        ...this.mapping.defaults
      }
    }

    // 4. No configuration found
    throw new Error(`No team configuration found for repository: ${repository}`)
  }

  /**
   * Checks if a repository has an exact or wildcard match
   */
  hasMatchingConfiguration(repository: string): boolean {
    // Check exact match
    if (this.mapping.mappings[repository]) {
      return true
    }

    // Check wildcard patterns
    for (const pattern of Object.keys(this.mapping.mappings)) {
      if (this.matchesWildcardPattern(repository, pattern)) {
        return true
      }
    }

    // Check fallback
    return this.mapping.fallback?.auto_create ?? false
  }

  /**
   * Gets all repositories that have explicit mappings (not wildcards)
   */
  getExplicitRepositories(): string[] {
    return Object.keys(this.mapping.mappings).filter(
      (key) => !key.includes('*')
    )
  }

  /**
   * Gets all wildcard patterns
   */
  getWildcardPatterns(): string[] {
    return Object.keys(this.mapping.mappings).filter((key) => key.includes('*'))
  }

  /**
   * Builds complete team configuration by merging with defaults
   */
  private buildTeamConfig(
    config: TeamConfiguration,
    defaults?: DefaultSettings
  ): TeamConfiguration {
    return {
      ...defaults,
      ...config,
      // Ensure members array is not overridden by defaults
      members: config.members
    }
  }

  /**
   * Checks if repository matches a wildcard pattern
   * Supports simple * wildcards
   */
  private matchesWildcardPattern(repository: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return false
    }

    // Escape regex special chars except *
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\\\]/g, '\\$&')
      .replace(/\*/g, '.*')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(repository)
  }
}
