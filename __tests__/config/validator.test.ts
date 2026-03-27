/**
 * Unit tests for Configuration Validator
 */

import { describe, expect, it } from '@jest/globals'
import {
  validateMapping,
  safeValidateMapping
} from '../../src/config/validator.js'

describe('config/validator.ts', () => {
  describe('validateMapping', () => {
    it('should validate a valid minimal configuration', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const result = validateMapping(config)

      expect(result.version).toBe('1.0')
      expect(result.mappings['my-repo'].team_name).toBe('My Team')
      expect(result.mappings['my-repo'].members).toEqual([])
    })

    it('should validate configuration with all fields', () => {
      const config = {
        version: '1.0',
        defaults: {
          business_unit: 'Engineering',
          member_only: false,
          auto_add_collaborators: true,
          incremental_updates: true
        },
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            description: 'Team description',
            business_unit: 'Security',
            member_only: true,
            members: [
              { user: 'user@example.com', relationship: 'ADMIN' },
              { user: 'member@example.com', relationship: 'MEMBER' }
            ],
            sync_github_collaborators: true,
            github_collaborator_filter: ['admin', 'write']
          }
        },
        fallback: {
          auto_create: true,
          team_name_template: '{repository} Team',
          default_members: [
            { user: 'admin@example.com', relationship: 'ADMIN' }
          ]
        }
      }

      const result = validateMapping(config)

      expect(result.defaults?.business_unit).toBe('Engineering')
      expect(result.mappings['my-repo'].members).toHaveLength(2)
      expect(result.fallback?.auto_create).toBe(true)
    })

    it('should validate multiple repository mappings', () => {
      const config = {
        version: '1.0',
        mappings: {
          'repo-1': {
            team_name: 'Team 1',
            members: []
          },
          'repo-2': {
            team_name: 'Team 2',
            members: []
          },
          'repo-*': {
            team_name: 'Wildcard Team',
            members: []
          }
        }
      }

      const result = validateMapping(config)

      expect(Object.keys(result.mappings)).toHaveLength(3)
      expect(result.mappings['repo-1']).toBeDefined()
      expect(result.mappings['repo-*']).toBeDefined()
    })

    it('should throw error for missing version', () => {
      const config = {
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      expect(() => validateMapping(config)).toThrow('version')
    })

    it('should throw error for missing mappings', () => {
      const config = {
        version: '1.0'
      }

      expect(() => validateMapping(config)).toThrow('mappings')
    })

    it('should throw error for missing team_name', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            members: []
          }
        }
      }

      expect(() => validateMapping(config)).toThrow('team_name')
    })

    it('should throw error for invalid team_name length', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'a'.repeat(257), // Too long
            members: []
          }
        }
      }

      expect(() => validateMapping(config)).toThrow('256 characters')
    })

    it('should throw error for empty team_name', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: '',
            members: []
          }
        }
      }

      expect(() => validateMapping(config)).toThrow()
    })

    it('should throw error for invalid relationship', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [
              { user: 'user@example.com', relationship: 'OWNER' } // Invalid
            ]
          }
        }
      }

      expect(() => validateMapping(config)).toThrow('ADMIN or MEMBER')
    })

    it('should throw error for missing user in member', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [
              { relationship: 'ADMIN' } // Missing user
            ]
          }
        }
      }

      expect(() => validateMapping(config)).toThrow()
    })

    it('should default members to empty array if not provided', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team'
            // members not provided
          }
        }
      }

      const result = validateMapping(config)

      expect(result.mappings['my-repo'].members).toEqual([])
    })

    it('should validate github_collaborator_filter values', () => {
      const validConfig = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [],
            github_collaborator_filter: ['admin', 'write', 'read']
          }
        }
      }

      expect(() => validateMapping(validConfig)).not.toThrow()

      const invalidConfig = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [],
            github_collaborator_filter: ['admin', 'invalid']
          }
        }
      }

      expect(() => validateMapping(invalidConfig)).toThrow()
    })

    it('should validate fallback configuration', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        },
        fallback: {
          auto_create: true,
          team_name_template: '{repository} Team'
        }
      }

      const result = validateMapping(config)

      expect(result.fallback?.auto_create).toBe(true)
      expect(result.fallback?.team_name_template).toBe('{repository} Team')
    })

    it('should throw error for invalid fallback', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        },
        fallback: {
          // Missing auto_create
          team_name_template: '{repository} Team'
        }
      }

      expect(() => validateMapping(config)).toThrow()
    })

    it('should handle complex nested validation errors', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: [
              { user: '', relationship: 'ADMIN' }, // Empty user
              { user: 'valid@example.com', relationship: 'INVALID' } // Invalid relationship
            ]
          }
        }
      }

      expect(() => validateMapping(config)).toThrow()
    })
  })

  describe('safeValidateMapping', () => {
    it('should return success for valid configuration', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const result = safeValidateMapping(config)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should return error for invalid configuration', () => {
      const config = {
        version: '1.0',
        mappings: {
          'my-repo': {
            // Missing team_name
            members: []
          }
        }
      }

      const result = safeValidateMapping(config)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error).toContain('team_name')
    })

    it('should return error message for invalid types', () => {
      const config = {
        version: 1.0, // Should be string
        mappings: {
          'my-repo': {
            team_name: 'My Team',
            members: []
          }
        }
      }

      const result = safeValidateMapping(config)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle null input', () => {
      const result = safeValidateMapping(null)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle undefined input', () => {
      const result = safeValidateMapping(undefined)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
