/**
 * GitHub Service
 *
 * Handles GitHub API interactions for fetching repository collaborators
 * and merging them with configured team members.
 */

import * as core from '@actions/core'
import type { getOctokit } from '@actions/github'
import type { TeamMember } from '../types.js'
import { normalizeEmail } from '../utils.js'

type GitHubClient = ReturnType<typeof getOctokit>

/**
 * Service for interacting with GitHub API
 */
export class GitHubService {
  constructor(private octokit: GitHubClient) {}

  /**
   * Fetches collaborators from a GitHub repository
   */
  async fetchCollaborators(
    owner: string,
    repo: string,
    filter?: ('admin' | 'write' | 'read')[]
  ): Promise<TeamMember[]> {
    core.info(`Fetching collaborators for ${owner}/${repo}`)

    try {
      const { data: collaborators } =
        await this.octokit.rest.repos.listCollaborators({
          owner,
          repo,
          affiliation: 'direct'
        })

      core.info(`Found ${collaborators.length} collaborators`)

      const members: TeamMember[] = []

      for (const collab of collaborators) {
        // Determine permission level
        const permission = this.getPermissionLevel(collab.permissions)

        // Filter by permission if specified
        if (filter && filter.length > 0 && !filter.includes(permission)) {
          core.debug(`Skipping ${collab.login} (permission: ${permission})`)
          continue
        }

        // Fetch user email
        const email = await this.getUserEmail(collab.login)
        if (!email) {
          core.warning(`Could not find email for user: ${collab.login}`)
          continue
        }

        // Determine relationship based on permissions
        const relationship = permission === 'admin' ? 'ADMIN' : 'MEMBER'

        members.push({
          user: email,
          relationship
        })

        core.debug(`Added collaborator: ${email} (${relationship})`)
      }

      core.info(`Processed ${members.length} collaborators`)
      return members
    } catch (error) {
      core.error(`Failed to fetch collaborators: ${(error as Error).message}`)
      throw error
    }
  }

  /**
   * Gets permission level from permissions object
   */
  private getPermissionLevel(
    permissions: { admin?: boolean; push?: boolean; pull?: boolean } | undefined
  ): 'admin' | 'write' | 'read' {
    if (permissions?.admin) return 'admin'
    if (permissions?.push) return 'write'
    return 'read'
  }

  /**
   * Fetches email address for a GitHub user
   */
  private async getUserEmail(username: string): Promise<string | null> {
    try {
      const { data: user } = await this.octokit.rest.users.getByUsername({
        username
      })

      return user.email
    } catch (error) {
      core.debug(
        `Failed to fetch email for ${username}: ${(error as Error).message}`
      )
      return null
    }
  }

  /**
   * Merges configured members with GitHub collaborators
   * Configured members take precedence
   */
  static mergeMembers(
    configMembers: TeamMember[],
    githubMembers: TeamMember[]
  ): TeamMember[] {
    const memberMap = new Map<string, TeamMember>()

    // Add configured members first (they take precedence)
    for (const member of configMembers) {
      memberMap.set(normalizeEmail(member.user), member)
    }

    // Add GitHub members if not already present
    for (const member of githubMembers) {
      const normalizedEmail = normalizeEmail(member.user)
      if (!memberMap.has(normalizedEmail)) {
        memberMap.set(normalizedEmail, member)
      }
    }

    return Array.from(memberMap.values())
  }
}
