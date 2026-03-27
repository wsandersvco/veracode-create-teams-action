/**
 * Unit tests for GitHub Service
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { getOctokit } from '@actions/github'
import type { GitHubService as GitHubServiceType } from '../../src/services/github-service.js'
import type { TeamMember } from '../../src/types.js'

type GitHubClient = ReturnType<typeof getOctokit>

// Mock GitHub client
const mockListCollaborators = jest.fn()
const mockGetByUsername = jest.fn()
const mockOctokit = {
  rest: {
    repos: {
      listCollaborators: mockListCollaborators
    },
    users: {
      getByUsername: mockGetByUsername
    }
  }
} as unknown as GitHubClient

jest.unstable_mockModule('@actions/core', () => core)

describe('services/github-service.ts', () => {
  let GitHubService: typeof GitHubServiceType
  let service: GitHubServiceType

  beforeEach(async () => {
    const module = await import('../../src/services/github-service.js')
    GitHubService = module.GitHubService

    jest.clearAllMocks()
    service = new GitHubService(mockOctokit)
  })

  describe('fetchCollaborators', () => {
    it('should fetch all collaborators successfully', async () => {
      const mockCollaborators = [
        {
          login: 'user1',
          permissions: { admin: true, push: true, pull: true }
        },
        {
          login: 'user2',
          permissions: { admin: false, push: true, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername
        .mockResolvedValueOnce({ data: { email: 'user1@example.com' } })
        .mockResolvedValueOnce({ data: { email: 'user2@example.com' } })

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        user: 'user1@example.com',
        relationship: 'ADMIN'
      })
      expect(result[1]).toEqual({
        user: 'user2@example.com',
        relationship: 'MEMBER'
      })
      expect(core.info).toHaveBeenCalledWith(
        'Fetching collaborators for owner/repo'
      )
      expect(core.info).toHaveBeenCalledWith('Found 2 collaborators')
      expect(core.info).toHaveBeenCalledWith('Processed 2 collaborators')
    })

    it('should filter collaborators by permission level', async () => {
      const mockCollaborators = [
        {
          login: 'admin1',
          permissions: { admin: true, push: true, pull: true }
        },
        {
          login: 'writer1',
          permissions: { admin: false, push: true, pull: true }
        },
        {
          login: 'reader1',
          permissions: { admin: false, push: false, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername
        .mockResolvedValueOnce({ data: { email: 'admin1@example.com' } })
        .mockResolvedValueOnce({ data: { email: 'writer1@example.com' } })

      const result = await service.fetchCollaborators('owner', 'repo', [
        'admin',
        'write'
      ])

      expect(result).toHaveLength(2)
      expect(result[0].user).toBe('admin1@example.com')
      expect(result[1].user).toBe('writer1@example.com')
      expect(core.debug).toHaveBeenCalledWith(
        'Skipping reader1 (permission: read)'
      )
    })

    it('should filter for admin only', async () => {
      const mockCollaborators = [
        {
          login: 'admin1',
          permissions: { admin: true, push: true, pull: true }
        },
        {
          login: 'writer1',
          permissions: { admin: false, push: true, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername.mockResolvedValue({
        data: { email: 'admin1@example.com' }
      })

      const result = await service.fetchCollaborators('owner', 'repo', [
        'admin'
      ])

      expect(result).toHaveLength(1)
      expect(result[0].user).toBe('admin1@example.com')
      expect(result[0].relationship).toBe('ADMIN')
    })

    it('should skip collaborators without email', async () => {
      const mockCollaborators = [
        {
          login: 'user1',
          permissions: { admin: false, push: true, pull: true }
        },
        {
          login: 'user2',
          permissions: { admin: false, push: true, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername
        .mockResolvedValueOnce({ data: { email: null } })
        .mockResolvedValueOnce({ data: { email: 'user2@example.com' } })

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result).toHaveLength(1)
      expect(result[0].user).toBe('user2@example.com')
      expect(core.warning).toHaveBeenCalledWith(
        'Could not find email for user: user1'
      )
    })

    it('should handle empty collaborator list', async () => {
      mockListCollaborators.mockResolvedValue({ data: [] })

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result).toHaveLength(0)
      expect(core.info).toHaveBeenCalledWith('Found 0 collaborators')
    })

    it('should determine correct permission levels', async () => {
      const mockCollaborators = [
        {
          login: 'admin',
          permissions: { admin: true, push: true, pull: true }
        },
        {
          login: 'writer',
          permissions: { admin: false, push: true, pull: true }
        },
        {
          login: 'reader',
          permissions: { admin: false, push: false, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername
        .mockResolvedValueOnce({ data: { email: 'admin@example.com' } })
        .mockResolvedValueOnce({ data: { email: 'writer@example.com' } })
        .mockResolvedValueOnce({ data: { email: 'reader@example.com' } })

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result[0].relationship).toBe('ADMIN')
      expect(result[1].relationship).toBe('MEMBER')
      expect(result[2].relationship).toBe('MEMBER')
    })

    it('should handle undefined permissions', async () => {
      const mockCollaborators = [
        {
          login: 'user1',
          permissions: undefined
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername.mockResolvedValue({
        data: { email: 'user1@example.com' }
      })

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result).toHaveLength(1)
      expect(result[0].relationship).toBe('MEMBER') // Defaults to read -> MEMBER
    })

    it('should handle getUserEmail failure', async () => {
      const mockCollaborators = [
        {
          login: 'user1',
          permissions: { admin: false, push: true, pull: true }
        }
      ]

      mockListCollaborators.mockResolvedValue({ data: mockCollaborators })
      mockGetByUsername.mockRejectedValue(new Error('User not found'))

      const result = await service.fetchCollaborators('owner', 'repo')

      expect(result).toHaveLength(0)
      expect(core.warning).toHaveBeenCalledWith(
        'Could not find email for user: user1'
      )
      expect(core.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch email for user1')
      )
    })

    it('should throw error when API call fails', async () => {
      mockListCollaborators.mockRejectedValue(
        new Error('API rate limit exceeded')
      )

      await expect(service.fetchCollaborators('owner', 'repo')).rejects.toThrow(
        'API rate limit exceeded'
      )

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch collaborators')
      )
    })

    it('should call listCollaborators with correct parameters', async () => {
      mockListCollaborators.mockResolvedValue({ data: [] })

      await service.fetchCollaborators('test-owner', 'test-repo')

      expect(mockListCollaborators).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        affiliation: 'direct'
      })
    })
  })

  describe('mergeMembers', () => {
    it('should merge configured and GitHub members', async () => {
      const configMembers: TeamMember[] = [
        { user: 'config@example.com', relationship: 'ADMIN' }
      ]

      const githubMembers: TeamMember[] = [
        { user: 'github@example.com', relationship: 'MEMBER' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual({
        user: 'config@example.com',
        relationship: 'ADMIN'
      })
      expect(result).toContainEqual({
        user: 'github@example.com',
        relationship: 'MEMBER'
      })
    })

    it('should give precedence to configured members', async () => {
      const configMembers: TeamMember[] = [
        { user: 'user@example.com', relationship: 'ADMIN' }
      ]

      const githubMembers: TeamMember[] = [
        { user: 'user@example.com', relationship: 'MEMBER' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        user: 'user@example.com',
        relationship: 'ADMIN'
      })
    })

    it('should handle case-insensitive email matching', async () => {
      const configMembers: TeamMember[] = [
        { user: 'User@Example.COM', relationship: 'ADMIN' }
      ]

      const githubMembers: TeamMember[] = [
        { user: 'user@example.com', relationship: 'MEMBER' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(1)
      expect(result[0].user).toBe('User@Example.COM') // Keeps first occurrence
    })

    it('should handle empty configured members', async () => {
      const configMembers: TeamMember[] = []

      const githubMembers: TeamMember[] = [
        { user: 'github1@example.com', relationship: 'MEMBER' },
        { user: 'github2@example.com', relationship: 'ADMIN' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(2)
      expect(result).toEqual(githubMembers)
    })

    it('should handle empty GitHub members', async () => {
      const configMembers: TeamMember[] = [
        { user: 'config1@example.com', relationship: 'ADMIN' },
        { user: 'config2@example.com', relationship: 'MEMBER' }
      ]

      const githubMembers: TeamMember[] = []

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(2)
      expect(result).toEqual(configMembers)
    })

    it('should handle both empty arrays', async () => {
      const result = GitHubService.mergeMembers([], [])

      expect(result).toHaveLength(0)
    })

    it('should handle multiple duplicates', async () => {
      const configMembers: TeamMember[] = [
        { user: 'user1@example.com', relationship: 'ADMIN' },
        { user: 'user2@example.com', relationship: 'ADMIN' }
      ]

      const githubMembers: TeamMember[] = [
        { user: 'user1@example.com', relationship: 'MEMBER' },
        { user: 'user2@example.com', relationship: 'MEMBER' },
        { user: 'user3@example.com', relationship: 'MEMBER' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(3)
      expect(result.filter((m) => m.relationship === 'ADMIN')).toHaveLength(2)
      expect(result.filter((m) => m.relationship === 'MEMBER')).toHaveLength(1)
    })

    it('should preserve order with config members first', async () => {
      const configMembers: TeamMember[] = [
        { user: 'config1@example.com', relationship: 'ADMIN' },
        { user: 'config2@example.com', relationship: 'ADMIN' }
      ]

      const githubMembers: TeamMember[] = [
        { user: 'github1@example.com', relationship: 'MEMBER' },
        { user: 'github2@example.com', relationship: 'MEMBER' }
      ]

      const result = GitHubService.mergeMembers(configMembers, githubMembers)

      expect(result).toHaveLength(4)
      // Config members should appear first
      expect(result[0].user).toBe('config1@example.com')
      expect(result[1].user).toBe('config2@example.com')
    })
  })
})
