/**
 * Unit tests for Veracode API client (src/veracode/client.ts)
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { VeracodeTeam, VeracodeUser } from '../../src/types.js'
import type { VeracodeClient as VeracodeClientType } from '../../src/veracode/client.js'

// Mock axios
const mockAxiosGet = jest.fn()
const mockAxiosPost = jest.fn()
const mockAxiosPut = jest.fn()
const mockAxiosCreate = jest.fn(() => ({
  get: mockAxiosGet,
  post: mockAxiosPost,
  put: mockAxiosPut,
  interceptors: {
    request: { use: jest.fn((fn: unknown) => fn) },
    response: { use: jest.fn((fn: unknown) => fn) }
  }
}))

jest.unstable_mockModule('axios', () => ({
  default: {
    create: mockAxiosCreate
  }
}))

jest.unstable_mockModule('@actions/core', () => core)

describe('veracode/client.ts', () => {
  let VeracodeClient: typeof VeracodeClientType
  let client: VeracodeClientType

  beforeEach(async () => {
    // Dynamically import after mocks are set up
    const module = await import('../../src/veracode/client.js')
    VeracodeClient = module.VeracodeClient

    jest.clearAllMocks()
    client = new VeracodeClient('test-api-id', 'abcd1234', 'US')
  })

  describe('constructor', () => {
    it('should create client with US region by default', () => {
      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.veracode.com',
          timeout: 30000
        })
      )
    })

    it('should create client with EU region', () => {
      jest.clearAllMocks()
      new VeracodeClient('test-id', 'abcd1234', 'EU')

      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.veracode.eu'
        })
      )
    })

    it('should create client with FEDERAL region', () => {
      jest.clearAllMocks()
      new VeracodeClient('test-id', 'abcd1234', 'FEDERAL')

      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.fed.veracode.us'
        })
      )
    })

    it('should set correct headers', () => {
      expect(mockAxiosCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        })
      )
    })
  })

  describe('getTeams', () => {
    it('should fetch teams successfully', async () => {
      const mockTeams: VeracodeTeam[] = [
        {
          team_id: 'team-1',
          team_name: 'Test Team',
          team_legacy_id: 123
        }
      ]

      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { teams: mockTeams },
          page: { size: 50, totalElements: 1, totalPages: 1, number: 0 }
        }
      })

      const result = await client.getTeams()

      expect(mockAxiosGet).toHaveBeenCalledWith('/v2/teams', expect.any(Object))
      expect(result.teams).toEqual(mockTeams)
      expect(result.page.totalElements).toBe(1)
    })

    it('should use default pagination parameters', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { teams: [] },
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      await client.getTeams()

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/teams',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 0,
            size: 50,
            ignore_self_teams: true
          })
        })
      )
    })

    it('should use custom pagination parameters', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { teams: [] },
          page: { size: 100, totalElements: 0, totalPages: 0, number: 1 }
        }
      })

      await client.getTeams({
        pageable: { page: 1, size: 100 }
      })

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/teams',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            size: 100
          })
        })
      )
    })

    it('should filter by team name', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { teams: [] },
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      await client.getTeams({ team_name: 'My Team' })

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/teams',
        expect.objectContaining({
          params: expect.objectContaining({
            team_name: 'My Team'
          })
        })
      )
    })

    it('should handle empty teams response', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      const result = await client.getTeams()

      expect(result.teams).toEqual([])
    })

    it('should throw VeracodeActionError on failure', async () => {
      mockAxiosGet.mockRejectedValue({
        response: { status: 500 },
        message: 'Internal Server Error'
      })

      await expect(client.getTeams()).rejects.toThrow('Failed to fetch teams')
    })
  })

  describe('getTeam', () => {
    it('should fetch team by ID', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'team-1',
        team_name: 'Test Team',
        team_legacy_id: 123
      }

      mockAxiosGet.mockResolvedValue({ data: mockTeam })

      const result = await client.getTeam('team-1')

      expect(mockAxiosGet).toHaveBeenCalledWith('/v2/teams/team-1')
      expect(result).toEqual(mockTeam)
    })

    it('should throw VeracodeActionError on failure', async () => {
      mockAxiosGet.mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found'
      })

      await expect(client.getTeam('invalid-id')).rejects.toThrow(
        'Failed to fetch team'
      )
    })
  })

  describe('createTeam', () => {
    it('should create team successfully', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'new-team',
        team_name: 'New Team',
        team_legacy_id: 456
      }

      mockAxiosPost.mockResolvedValue({ data: mockTeam })

      const result = await client.createTeam({
        team_name: 'New Team',
        bu_name: 'Engineering'
      })

      expect(mockAxiosPost).toHaveBeenCalledWith('/v2/teams', {
        team_name: 'New Team',
        bu_name: 'Engineering'
      })
      expect(result).toEqual(mockTeam)
      expect(core.info).toHaveBeenCalledWith('Creating team: New Team')
    })

    it('should create team with all parameters', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'new-team',
        team_name: 'New Team',
        team_legacy_id: 456
      }

      mockAxiosPost.mockResolvedValue({ data: mockTeam })

      await client.createTeam({
        team_name: 'New Team',
        bu_name: 'Engineering',
        member_only: true,
        description: 'Test description'
      })

      expect(mockAxiosPost).toHaveBeenCalledWith('/v2/teams', {
        team_name: 'New Team',
        bu_name: 'Engineering',
        member_only: true,
        description: 'Test description'
      })
    })

    it('should throw VeracodeActionError on failure', async () => {
      mockAxiosPost.mockRejectedValue({
        response: { status: 400 },
        message: 'Bad Request'
      })

      await expect(client.createTeam({ team_name: 'Test' })).rejects.toThrow(
        'Failed to create team'
      )
    })
  })

  describe('updateTeam', () => {
    it('should update team successfully', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'team-1',
        team_name: 'Updated Team',
        team_legacy_id: 123
      }

      mockAxiosPut.mockResolvedValue({ data: mockTeam })

      const result = await client.updateTeam('team-1', {
        team_name: 'Updated Team'
      })

      expect(mockAxiosPut).toHaveBeenCalledWith(
        '/v2/teams/team-1',
        { team_name: 'Updated Team' },
        expect.objectContaining({
          params: {
            partial: true,
            incremental: true
          }
        })
      )
      expect(result).toEqual(mockTeam)
    })

    it('should use custom update options', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'team-1',
        team_name: 'Updated Team',
        team_legacy_id: 123
      }

      mockAxiosPut.mockResolvedValue({ data: mockTeam })

      await client.updateTeam(
        'team-1',
        { team_name: 'Updated Team' },
        { partial: false, incremental: false }
      )

      expect(mockAxiosPut).toHaveBeenCalledWith(
        '/v2/teams/team-1',
        { team_name: 'Updated Team' },
        expect.objectContaining({
          params: {
            partial: false,
            incremental: false
          }
        })
      )
    })

    it('should update team with users', async () => {
      const mockTeam: VeracodeTeam = {
        team_id: 'team-1',
        team_name: 'Team',
        team_legacy_id: 123
      }

      mockAxiosPut.mockResolvedValue({ data: mockTeam })

      await client.updateTeam('team-1', {
        team_name: 'Team',
        users: [
          { user_name: 'user1@example.com', relationship: 'ADMIN' },
          { user_name: 'user2@example.com', relationship: 'MEMBER' }
        ]
      })

      expect(mockAxiosPut).toHaveBeenCalledWith(
        '/v2/teams/team-1',
        expect.objectContaining({
          users: [
            { user_name: 'user1@example.com', relationship: 'ADMIN' },
            { user_name: 'user2@example.com', relationship: 'MEMBER' }
          ]
        }),
        expect.any(Object)
      )
    })

    it('should throw VeracodeActionError on failure', async () => {
      mockAxiosPut.mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found'
      })

      await expect(
        client.updateTeam('invalid-id', { team_name: 'Test' })
      ).rejects.toThrow('Failed to update team')
    })
  })

  describe('getUsers', () => {
    it('should fetch users successfully', async () => {
      const mockUsers: VeracodeUser[] = [
        {
          user_id: 'user-1',
          user_name: 'testuser',
          email_address: 'test@example.com',
          active: true,
          login_enabled: true,
          account_type: 'USER'
        }
      ]

      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { users: mockUsers },
          page: { size: 50, totalElements: 1, totalPages: 1, number: 0 }
        }
      })

      const result = await client.getUsers()

      expect(mockAxiosGet).toHaveBeenCalledWith('/v2/users', expect.any(Object))
      expect(result.users).toEqual(mockUsers)
    })

    it('should search by term', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { users: [] },
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      await client.getUsers({ search_term: 'test@example.com' })

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/users',
        expect.objectContaining({
          params: expect.objectContaining({
            search_term: 'test@example.com'
          })
        })
      )
    })

    it('should filter by email address', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { users: [] },
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      await client.getUsers({ email_address: 'user@example.com' })

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/users',
        expect.objectContaining({
          params: expect.objectContaining({
            email_address: 'user@example.com'
          })
        })
      )
    })

    it('should filter by active status', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          _embedded: { users: [] },
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      await client.getUsers({ active: true })

      expect(mockAxiosGet).toHaveBeenCalledWith(
        '/v2/users',
        expect.objectContaining({
          params: expect.objectContaining({
            active: true
          })
        })
      )
    })

    it('should handle empty users response', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          page: { size: 50, totalElements: 0, totalPages: 0, number: 0 }
        }
      })

      const result = await client.getUsers()

      expect(result.users).toEqual([])
    })

    it('should throw VeracodeActionError on failure', async () => {
      mockAxiosGet.mockRejectedValue({
        response: { status: 500 },
        message: 'Internal Server Error'
      })

      await expect(client.getUsers()).rejects.toThrow('Failed to fetch users')
    })
  })
})
