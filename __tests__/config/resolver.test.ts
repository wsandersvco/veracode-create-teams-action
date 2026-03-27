/**
 * Unit tests for Configuration Resolver
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { ConfigurationResolver as ConfigurationResolverType } from '../../src/config/resolver.ts'
import type { TeamMapping } from '../../src/types.ts'

jest.unstable_mockModule('@actions/core', () => core)

describe('config/resolver.ts', () => {
  let ConfigurationResolver: typeof ConfigurationResolverType

  beforeEach(async () => {
    const module = await import('../../src/config/resolver.js')
    ConfigurationResolver = module.ConfigurationResolver
    jest.clearAllMocks()
  })

  describe('resolveTeamConfiguration', () => {
    it('should resolve exact repository match', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [{ user: 'user@example.com', relationship: 'ADMIN' }]
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('my-repo')

      expect(result.team_name).toBe('My Team')
      expect(result.members).toHaveLength(1)
      expect(core.info).toHaveBeenCalledWith('Found exact match in mappings')
    })

    it('should resolve wildcard pattern match', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-*': {
            team_name: 'Wildcard Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('repo-test')

      expect(result.team_name).toBe('Wildcard Team')
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Matched wildcard pattern')
      )
    })

    it('should prefer exact match over wildcard', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'Exact Match Team',
            members: []
          },
          'my-*': {
            team_name: 'Wildcard Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('my-repo')

      expect(result.team_name).toBe('Exact Match Team')
    })

    it('should use fallback when no match found', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {},
        fallback: {
          auto_create: true,
          team_name_template: '{repository} Team'
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('test-repo')

      expect(result.team_name).toBe('test-repo Team')
      expect(core.info).toHaveBeenCalledWith(
        'Using fallback auto-create configuration'
      )
    })

    it('should use default team name if template not provided', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {},
        fallback: {
          auto_create: true
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('test-repo')

      expect(result.team_name).toBe('test-repo Security Team')
    })

    it('should throw error when no match and no fallback', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {}
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(() => resolver.resolveTeamConfiguration('unknown-repo')).toThrow(
        'No team configuration found for repository: unknown-repo'
      )
    })

    it('should merge configuration with defaults', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        defaults: {
          business_unit: 'Engineering',
          member_only: false
        },
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('my-repo')

      expect(result.team_name).toBe('My Team')
      expect(result.business_unit).toBe('Engineering')
      expect(result.member_only).toBe(false)
    })

    it('should override defaults with specific config', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        defaults: {
          business_unit: 'Engineering',
          member_only: false
        },
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            business_unit: 'Security',
            member_only: true,
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('my-repo')

      expect(result.business_unit).toBe('Security')
      expect(result.member_only).toBe(true)
    })

    it('should include fallback default_members', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {},
        fallback: {
          auto_create: true,
          default_members: [
            { user: 'admin@example.com', relationship: 'ADMIN' }
          ]
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('test-repo')

      expect(result.members).toHaveLength(1)
      expect(result.members[0].user).toBe('admin@example.com')
    })

    it('should match complex wildcard patterns', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'frontend-*': {
            team_name: 'Frontend Team',
            members: []
          },
          'backend-*': {
            team_name: 'Backend Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      const frontendResult = resolver.resolveTeamConfiguration('frontend-app')
      expect(frontendResult.team_name).toBe('Frontend Team')

      const backendResult = resolver.resolveTeamConfiguration('backend-api')
      expect(backendResult.team_name).toBe('Backend Team')
    })

    it('should match wildcard at beginning', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          '*-service': {
            team_name: 'Service Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('auth-service')

      expect(result.team_name).toBe('Service Team')
    })

    it('should match wildcard in middle', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'app-*-service': {
            team_name: 'App Service Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('app-auth-service')

      expect(result.team_name).toBe('App Service Team')
    })

    it('should not match partial strings as wildcards', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-test': {
            team_name: 'Test Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(() => resolver.resolveTeamConfiguration('repo-')).toThrow()
      expect(() => resolver.resolveTeamConfiguration('repo')).toThrow()
    })
  })

  describe('hasMatchingConfiguration', () => {
    it('should return true for exact match', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('my-repo')).toBe(true)
    })

    it('should return true for wildcard match', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-*': {
            team_name: 'Wildcard Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('repo-test')).toBe(true)
    })

    it('should return true when fallback exists', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {},
        fallback: {
          auto_create: true
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('any-repo')).toBe(true)
    })

    it('should return false when no match and no fallback', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'other-repo': {
            team_name: 'Other Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('my-repo')).toBe(false)
    })

    it('should return false when fallback auto_create is false', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {},
        fallback: {
          auto_create: false
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('any-repo')).toBe(false)
    })
  })

  describe('getExplicitRepositories', () => {
    it('should return only non-wildcard repositories', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-1': {
            team_name: 'Team 1',
            members: []
          },
          'repo-*': {
            team_name: 'Wildcard Team',
            members: []
          },
          'repo-2': {
            team_name: 'Team 2',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const explicit = resolver.getExplicitRepositories()

      expect(explicit).toHaveLength(2)
      expect(explicit).toContain('repo-1')
      expect(explicit).toContain('repo-2')
      expect(explicit).not.toContain('repo-*')
    })

    it('should return empty array when no explicit repositories', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          '*-service': {
            team_name: 'Service Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.getExplicitRepositories()).toHaveLength(0)
    })
  })

  describe('getWildcardPatterns', () => {
    it('should return only wildcard patterns', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-1': {
            team_name: 'Team 1',
            members: []
          },
          'repo-*': {
            team_name: 'Wildcard Team',
            members: []
          },
          '*-service': {
            team_name: 'Service Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const wildcards = resolver.getWildcardPatterns()

      expect(wildcards).toHaveLength(2)
      expect(wildcards).toContain('repo-*')
      expect(wildcards).toContain('*-service')
      expect(wildcards).not.toContain('repo-1')
    })

    it('should return empty array when no wildcards', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'repo-1': {
            team_name: 'Team 1',
            members: []
          },
          'repo-2': {
            team_name: 'Team 2',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.getWildcardPatterns()).toHaveLength(0)
    })
  })

  describe('wildcard pattern matching edge cases', () => {
    it('should handle regex special characters in repository names', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('my-repo')).toBe(true)
      expect(resolver.hasMatchingConfiguration('my.repo')).toBe(false)
      expect(resolver.hasMatchingConfiguration('my+repo')).toBe(false)
    })

    it('should handle multiple wildcards in pattern', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          '*-*-service': {
            team_name: 'Multi Wildcard Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)
      const result = resolver.resolveTeamConfiguration('app-auth-service')

      expect(result.team_name).toBe('Multi Wildcard Team')
    })

    it('should not match if wildcard not in pattern', async () => {
      const mapping: TeamMapping = {
        version: '1.0',
        mappings: {
          'exact-repo-name': {
            team_name: 'Exact Team',
            members: []
          }
        }
      }

      const resolver = new ConfigurationResolver(mapping)

      expect(resolver.hasMatchingConfiguration('exact-repo-name')).toBe(true)
      expect(resolver.hasMatchingConfiguration('exact-repo')).toBe(false)
      expect(resolver.hasMatchingConfiguration('repo-name')).toBe(false)
    })
  })
})
