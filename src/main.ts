import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml'

type Octokit = ReturnType<typeof getOctokit>

/**
 * Fetches a file from a GitHub repository using the GitHub API.
 *
 * This function retrieves file content from a specified repository and path,
 * validates that the path points to a file (not a directory), checks rate limits,
 * and decodes the base64-encoded content returned by the GitHub API.
 *
 * @param options - Configuration object containing repository details
 * @param options.owner - GitHub repository owner (username or organization)
 * @param options.repository - GitHub repository name where the file is located
 * @param options.path - Path to the file within the repository
 * @param options.ref - Optional git reference (branch, tag, or commit SHA). If not provided, uses default branch
 * @param octokit - Authenticated Octokit instance for making GitHub API calls
 * @returns Promise that resolves to the decoded file content as a UTF-8 string
 * @throws {Error} If the file cannot be fetched, the path is a directory, or API call fails
 *
 * @example
 * const content = await fetchFileFromRepo(
 *   { owner: 'myorg', repository: 'config', path: 'runners.yaml', ref: 'main' },
 *   octokit
 * )
 */
async function fetchFileFromRepo(
  options: {
    owner: string
    path: string
    ref: string | undefined
    repository: string
  },
  octokit: Octokit
): Promise<string> {
  const { owner, path, ref, repository } = options

  try {
    // Check rate limit
    const rateLimit = await octokit.rest.rateLimit.get()
    core.debug(
      `Rate limit remaining: ${rateLimit.data.rate.remaining}/${rateLimit.data.rate.limit}`
    )
    core.debug(`Rate limit reset: ${rateLimit.data.rate.reset}`)

    core.info(
      `Fetching file: ${path} from ${owner}/${repository}${ref ? ` (ref: ${ref})` : ''}`
    )

    const response = await octokit.rest.repos.getContent({
      owner,
      path,
      repo: repository,
      ...(ref && { ref })
    })

    core.debug(JSON.stringify(response, null, 2))

    // Validate API response is valid and for GitHub file, not directory
    if (!('content' in response.data) || Array.isArray(response.data)) {
      throw new Error(
        `Path ${owner}/${repository}/${path}${ref ? ` (ref: ${ref})` : ''} is a directory, not a file`
      )
    }

    const content = Buffer.from(response.data.content, 'base64').toString(
      'utf-8'
    )

    core.info(`Successfully fetched file (${response.data.size} bytes)`)
    return content
  } catch (error) {
    const err = error as Error
    core.error(`Failed to fetch file: ${err.message}`)
    throw new Error(
      `Failed to fetch file from ${owner}/${repository}/${path}: ${err.message}`,
      { cause: error }
    )
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputs = {
      configRef: core.getInput('config-ref', { required: false }),
      configRepository: core.getInput('config-repository', {
        required: false
      }),
      githubToken: core.getInput('github-token', { required: true }),
      owner: core.getInput('owner', { required: true }),
      repository: core.getInput('repository', { required: true }),
      mappingPath: core.getInput('veracode-team-mapping-yaml', {
        required: true
      })
    }

    const octokit = getOctokit(inputs.githubToken)

    core.info(
      `Loading veracode-team-mapping-yaml from ${inputs.owner}/${inputs.configRepository}/${inputs.mappingPath}${inputs.configRef ? ` (ref: ${inputs.configRef})` : ''}`
    )
    const fileContent = await fetchFileFromRepo(
      {
        owner: inputs.owner,
        path: inputs.mappingPath,
        ref: inputs.configRef || undefined,
        repository: inputs.configRepository
      },
      octokit
    )

    const rawMapping = yaml.load(fileContent, { schema: FAILSAFE_SCHEMA })
    // const mapping = validateMapping(rawMapping)
    // core.debug(JSON.stringify(mapping, null, 2))
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}
