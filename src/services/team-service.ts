/**
 * Team Service
 *
 * Manages Veracode team operations including lookup, creation, and updates.
 */

import * as core from '@actions/core'
import { VeracodeClient } from '../veracode/client.js'
import type { TeamConfiguration, VeracodeTeam, TeamMember } from '../types.js'

const MAX_PAGES = 100 // Safety limit for pagination
const PAGE_SIZE = 100 // Maximum page size for efficiency

/**
 * Service for managing Veracode teams
 */
export class TeamService {
  constructor(private veracodeClient: VeracodeClient) {}

  /**
   * Finds a team by exact name match
   * Returns null if team not found
   */
  async findTeamByName(teamName: string): Promise<VeracodeTeam | null> {
    core.info(`Searching for team: ${teamName}`)

    let page = 0

    while (page < MAX_PAGES) {
      const response = await this.veracodeClient.getTeams({
        pageable: { page, size: PAGE_SIZE },
        team_name: teamName,
        ignore_self_teams: true
      })

      // Search for exact match (API may return partial matches)
      const exactMatch = response.teams.find(
        (team) => team.team_name === teamName
      )

      if (exactMatch) {
        core.info(`Found existing team: ${teamName} (${exactMatch.team_id})`)
        return exactMatch
      }

      // Check if there are more pages
      if (response.teams.length < PAGE_SIZE) {
        break
      }

      page++
    }

    core.info(`Team not found: ${teamName}`)
    return null
  }

  /**
   * Creates a new team with the specified configuration
   */
  async createTeam(config: TeamConfiguration): Promise<VeracodeTeam> {
    core.info(`Creating new team: ${config.team_name}`)

    // Create the team first
    const team = await this.veracodeClient.createTeam({
      team_name: config.team_name,
      bu_name: config.business_unit,
      member_only: config.member_only ?? false,
      description: config.description
    })

    core.info(`Team created successfully: ${team.team_name} (${team.team_id})`)

    // Add members if any
    if (config.members.length > 0) {
      core.info(`Adding ${config.members.length} members to team...`)
      await this.addMembersToTeam(team.team_id, config.members)
      core.info(`Members added successfully`)
    }

    return team
  }

  /**
   * Updates an existing team incrementally
   */
  async updateTeam(
    teamId: string,
    config: TeamConfiguration
  ): Promise<VeracodeTeam> {
    core.info(`Updating team: ${config.team_name} (${teamId})`)

    const teamUpdate = {
      team_name: config.team_name,
      bu_name: config.business_unit,
      member_only: config.member_only,
      description: config.description,
      users: config.members.map((m) => ({
        user_name: m.user,
        relationship: m.relationship
      }))
    }

    // Use partial and incremental flags for safe updates
    const updatedTeam = await this.veracodeClient.updateTeam(
      teamId,
      teamUpdate,
      {
        partial: true, // Only update provided fields
        incremental: true // Add users without removing existing
      }
    )

    core.info(
      `Team updated successfully: ${config.members.length} members processed`
    )
    return updatedTeam
  }

  /**
   * Adds members to an existing team
   */
  private async addMembersToTeam(
    teamId: string,
    members: TeamMember[]
  ): Promise<void> {
    // Use the update endpoint with incremental flag
    await this.veracodeClient.updateTeam(
      teamId,
      {
        team_name: '', // Not updated when partial=true
        users: members.map((m) => ({
          user_name: m.user,
          relationship: m.relationship
        }))
      },
      {
        partial: true,
        incremental: true
      }
    )
  }

  /**
   * Creates or updates a team based on whether it exists
   */
  async createOrUpdateTeam(
    config: TeamConfiguration
  ): Promise<{ team: VeracodeTeam; action: 'created' | 'updated' }> {
    const existingTeam = await this.findTeamByName(config.team_name)

    if (existingTeam) {
      const team = await this.updateTeam(existingTeam.team_id, config)
      return { team, action: 'updated' }
    } else {
      const team = await this.createTeam(config)
      return { team, action: 'created' }
    }
  }
}
