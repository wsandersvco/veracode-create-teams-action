/**
 * Veracode Identity API client
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import * as core from '@actions/core'
import { generateAuthHeader, getBaseUrl } from './auth.js'
import {
  VeracodeTeam,
  VeracodeUser,
  Pageable,
  PaginatedResponse
} from '../types.js'
import {
  VeracodeActionError,
  ErrorCategory,
  categorizeError
} from '../errors.js'

/**
 * Parameters for getting teams
 */
interface GetTeamsParams {
  pageable?: Pageable
  team_name?: string
  ignore_self_teams?: boolean
}

/**
 * Parameters for getting users
 */
interface GetUsersParams {
  pageable?: Pageable
  search_term?: string
  email_address?: string
  user_name?: string
  active?: boolean
}

/**
 * Parameters for creating a team
 */
interface CreateTeamParams {
  team_name: string
  bu_name?: string
  member_only?: boolean
  description?: string
}

/**
 * Parameters for updating a team
 */
interface UpdateTeamParams {
  team_name: string
  bu_name?: string
  member_only?: boolean
  description?: string
  users?: Array<{ user_name: string; relationship: string }>
}

/**
 * Options for team update operations
 */
interface UpdateTeamOptions {
  partial?: boolean
  incremental?: boolean
}

/**
 * Veracode Identity API client
 */
export class VeracodeClient {
  private client: AxiosInstance
  private apiId: string
  private apiKey: string
  private baseUrl: string

  constructor(
    apiId: string,
    apiKey: string,
    region: 'US' | 'EU' | 'FEDERAL' = 'US'
  ) {
    this.apiId = apiId
    this.apiKey = apiKey
    this.baseUrl = getBaseUrl(region)

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      // Extract host from baseUrl (e.g., "api.veracode.com" from "https://api.veracode.com/api/authn")
      const host = new URL(this.baseUrl).hostname

      // Extract the path prefix from baseUrl (e.g., "/api/authn")
      const baseUrlPath = new URL(this.baseUrl).pathname

      // Build full URL path for HMAC signature (must include /api/authn prefix)
      let urlPath = baseUrlPath + (config.url || '')
      if (config.params) {
        // Build query string with proper percent-encoding (not plus-encoding)
        // Veracode API requires %20 for spaces, not +
        const queryParts: string[] = []
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParts.push(
              `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
            )
          }
        })
        if (queryParts.length > 0) {
          urlPath += `?${queryParts.join('&')}`
        }
      }

      const authHeader = generateAuthHeader(
        this.apiId,
        this.apiKey,
        urlPath,
        config.method?.toUpperCase() || 'GET',
        host
      )
      config.headers.Authorization = authHeader
      core.debug(`Request: ${config.method?.toUpperCase()} ${urlPath}`)

      // Update config.url to include query string and clear params
      // to prevent axios from adding params with potentially different encoding
      if (config.params) {
        config.url =
          (config.url || '') +
          (urlPath.includes('?') ? urlPath.substring(urlPath.indexOf('?')) : '')
        config.params = undefined
      }

      return config
    })
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        core.debug(`Response: ${response.status} ${response.statusText}`)
        return response
      },
      (error) => {
        this.handleApiError(error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Handle API errors with proper categorization
   */
  private handleApiError(error: AxiosError): void {
    const category = categorizeError(error)
    const message =
      (error.response?.data as { message?: string })?.message || error.message

    core.error(`Veracode API Error [${category}]: ${message}`)

    if (error.response?.data) {
      core.debug(`Response data: ${JSON.stringify(error.response.data)}`)
    }
  }

  /**
   * GET /v2/teams - List teams with optional filtering
   */
  async getTeams(params: GetTeamsParams = {}): Promise<{
    teams: VeracodeTeam[]
    page: {
      size: number
      totalElements: number
      totalPages: number
      number: number
    }
  }> {
    try {
      const response = await this.client.get<PaginatedResponse<VeracodeTeam>>(
        '/v2/teams',
        {
          params: {
            page: params.pageable?.page || 0,
            size: params.pageable?.size || 50,
            team_name: params.team_name,
            ignore_self_teams: params.ignore_self_teams ?? true
          }
        }
      )

      return {
        teams: response.data._embedded?.teams || [],
        page: response.data.page
      }
    } catch (error) {
      throw new VeracodeActionError(
        'Failed to fetch teams from Veracode',
        ErrorCategory.API_ERROR,
        true,
        (error as AxiosError).response?.status,
        error as Error
      )
    }
  }

  /**
   * GET /v2/teams/{teamId} - Get team by ID
   */
  async getTeam(teamId: string): Promise<VeracodeTeam> {
    try {
      const response = await this.client.get<VeracodeTeam>(
        `/v2/teams/${teamId}`
      )
      return response.data
    } catch (error) {
      throw new VeracodeActionError(
        `Failed to fetch team ${teamId}`,
        ErrorCategory.API_ERROR,
        true,
        (error as AxiosError).response?.status,
        error as Error
      )
    }
  }

  /**
   * POST /v2/teams - Create new team
   */
  async createTeam(team: CreateTeamParams): Promise<VeracodeTeam> {
    try {
      core.info(`Creating team: ${team.team_name}`)
      const response = await this.client.post<VeracodeTeam>('/v2/teams', team)
      core.info(`Team created successfully: ${response.data.team_id}`)
      return response.data
    } catch (error) {
      throw new VeracodeActionError(
        `Failed to create team ${team.team_name}`,
        ErrorCategory.API_ERROR,
        false,
        (error as AxiosError).response?.status,
        error as Error
      )
    }
  }

  /**
   * PUT /v2/teams/{teamId} - Update team
   */
  async updateTeam(
    teamId: string,
    team: UpdateTeamParams,
    options: UpdateTeamOptions = {}
  ): Promise<VeracodeTeam> {
    try {
      core.info(`Updating team: ${teamId}`)
      const response = await this.client.put<VeracodeTeam>(
        `/v2/teams/${teamId}`,
        team,
        {
          params: {
            partial: options.partial ?? true,
            incremental: options.incremental ?? true
          }
        }
      )
      core.info('Team updated successfully')
      return response.data
    } catch (error) {
      throw new VeracodeActionError(
        `Failed to update team ${teamId}`,
        ErrorCategory.API_ERROR,
        false,
        (error as AxiosError).response?.status,
        error as Error
      )
    }
  }

  /**
   * GET /v2/users - Search for users
   */
  async getUsers(params: GetUsersParams = {}): Promise<{
    users: VeracodeUser[]
    page: {
      size: number
      totalElements: number
      totalPages: number
      number: number
    }
  }> {
    try {
      const response = await this.client.get<PaginatedResponse<VeracodeUser>>(
        '/v2/users',
        {
          params: {
            page: params.pageable?.page || 0,
            size: params.pageable?.size || 50,
            search_term: params.search_term,
            email_address: params.email_address,
            user_name: params.user_name,
            active: params.active
          }
        }
      )

      return {
        users: response.data._embedded?.users || [],
        page: response.data.page
      }
    } catch (error) {
      throw new VeracodeActionError(
        'Failed to fetch users from Veracode',
        ErrorCategory.API_ERROR,
        true,
        (error as AxiosError).response?.status,
        error as Error
      )
    }
  }
}
