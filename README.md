# select-runs-on-action

![Linter](https://github.com/wsandersvc/select-runs-on-action/actions/workflows/linter.yml/badge.svg)
![CI](https://github.com/wsandersvc/select-runs-on-action/actions/workflows/ci.yml/badge.svg)
![Check dist/](https://github.com/wsandersvc/select-runs-on-action/actions/workflows/check-dist.yml/badge.svg)
![CodeQL](https://github.com/wsandersvc/select-runs-on-action/actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](./badges/coverage.svg)

## Roadmap

- Changes required to integrate with Veracode Workflow App.

## Initial Setup

1. Create the file `runs-on-mapping.yaml` in your `veracode` or configuration
   repository.
   - Ensure the format is correct.

## Modify Veracode Workflow App

Please see [action.yml](./action.yml) for supported inputs and outputs. You will
need to update the relevant sections for `build_runs_on` and `default_runs_on`
with the following: `${{ needs.runs_on_validations.outputs.override_runs_on }}`
and set the `runs_on_validations` job as a `need` in jobs where the
override_runs_on output is referenced.

```yaml
runs_on_validations:
  needs: validations
  runs-on:
    ${{ fromJson(github.event.client_payload.user_config.default_runs_on) }}
  name: Runner Validations
  outputs:
    override_runs_on: ${{ steps.select-runs-on-action.outputs.runs-on }}
  steps:
    - name: Verify Runner Mappings
      id: select-runs-on-action
      uses: wsandersvc/select-runs-on-action@v1
      with:
        github-token: ${{ github.event.client_payload.token }}
        owner: ${{ github.event.client_payload.repository.owner }}
        repository: ${{ github.event.client_payload.repository.name }}
        default-runs-on:
          ${{ github.event.client_payload.user_config.default_runs_on }}
        runs-on-mapping-yaml: runs-on-mapping.yaml
```

### Running as a distributed script

Note, that all parameters are required when executing this way.

```yaml
runs_on_validations:
  needs: validations
  runs-on:
    ${{ fromJson(github.event.client_payload.user_config.default_runs_on) }}
  name: Runner Validations
  outputs:
    override_runs_on: ${{ steps.select-runs-on-action.outputs.runs-on }}
  steps:
    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: 24.14.0

    - name: Checkout
      uses: actions/checkout@v4

    - name: Verify Runner Mappings
      id: select-runs-on-action
      env:
        INPUT_GITHUB-TOKEN: ${{ github.event.client_payload.token }}
        INPUT_OWNER: ${{ github.event.client_payload.repository.owner }}
        INPUT_REPOSITORY: ${{ github.event.client_payload.repository.name }}
        INPUT_CONFIG-REPOSITORY: veracode
        INPUT_DEFAULT-RUNS-ON:
          ${{ github.event.client_payload.user_config.default_runs_on }}
        INPUT_RUNS-ON-MAPPING-YAML: runs-on-mapping.yaml
      run: |
        node scripts/action-select-runs-on-action.js
```

Optionally define the following if the mapping YAML file resides in a custom
location.

```yaml
with:
  config-repository: my-custom-repository
```

## Troubleshooting

### Common Issues and Solutions

#### Error: "Invalid default-runs-on-format"

**Cause:** The `default-runs-on` input is not in the expected format.

**Expected Format:** `[ 'runner-name' ]` (array with single quotes containing
exactly one element)

**Solutions:**

```yaml
# ✅ Correct
default-runs-on: "[ 'ubuntu-latest' ]"

# ❌ Wrong - missing quotes around array
default-runs-on: [ 'ubuntu-latest' ]

# ❌ Wrong - empty array
default-runs-on: "[]"

# ❌ Wrong - multiple elements
default-runs-on: "[ 'ubuntu-latest', 'windows-latest' ]"
```

#### Error: "Mapping YAML must be an object"

**Cause:** The YAML file is not formatted correctly or is empty.

**Solutions:**

- Verify the YAML file exists at the specified path
- Check that the YAML file contains a valid object structure
- Ensure the file is not empty

**Expected YAML Format:**

```yaml
ubuntu-latest:
  - repo1
  - repo2
windows-latest:
  - repo3
  - repo4
```

#### Error: "No valid runner mappings found in YAML file"

**Cause:** All entries in the YAML file are invalid or have incorrect structure.

**Common Issues:**

```yaml
# ❌ Wrong - values are strings, not arrays
ubuntu-latest: "repo1"
windows-latest: "repo2"

# ❌ Wrong - values are numbers
ubuntu-latest: 123

# ✅ Correct - values are arrays of strings
ubuntu-latest:
  - repo1
  - repo2
```

#### Error: "Failed to fetch file from owner/repository/path"

**Causes and Solutions:**

1. **File doesn't exist**
   - Verify the `runs-on-mapping-yaml` path is correct
   - Check the file exists in the `config-repository`
   - Verify you're using the correct branch/ref

2. **Permission issues**
   - Ensure the `github-token` has `repo` read access
   - Verify the token can access the config repository
   - Check if the repository is private and token has appropriate permissions

3. **Path is a directory**
   - Ensure the path points to a file, not a directory
   - Add the filename to the path (e.g., `path/to/file.yaml`)

#### Warning: "Skipping key: value is not an array"

**Cause:** One or more entries in the YAML have invalid values.

**Behavior:** The action will skip invalid entries and continue with valid ones.

**Example:**

```yaml
ubuntu-latest:
  - repo1 # ✅ Valid - will be used
windows-latest: 'not-an-array' # ❌ Invalid - will be skipped with warning
macos-latest:
  - repo2 # ✅ Valid - will be used
```

**Solution:** Fix the invalid entry to use an array format.

#### Repository not matching expected runner

**Issue:** A repository is using the default runner instead of the one specified
in the mapping.

**Troubleshooting Steps:**

1. **Check repository name matches exactly**
   - Repository names are case-sensitive
   - Must match exactly (no partial matching)

   ```yaml
   ubuntu-latest:
     - my-repo # Will match "my-repo"
     # Will NOT match "my-repo-dev" or "My-Repo"
   ```

2. **Verify YAML file is being read from correct location**
   - Check the `config-repository` input
   - Verify the `ref` parameter if specified
   - Look at action logs for "Loading runs-on-mapping-yaml from..." message

3. **Check for typos in YAML file**
   - Verify spelling of repository names
   - Check for extra spaces or special characters

4. **Enable debug logging**
   - Set `ACTIONS_STEP_DEBUG` secret to `true` in your repository
   - Re-run the workflow to see detailed debug logs

#### Rate Limit Issues

**Symptoms:** API calls failing or warnings about rate limits

**Solutions:**

1. **Check current rate limit status**
   - Look for "Rate limit remaining:" in debug logs
   - GitHub API has limits: 5,000 requests/hour for authenticated requests

2. **Optimize token usage**
   - Use a dedicated token for this action
   - Consider using a GitHub App token (higher limits)
   - Cache the runs-on-mapping.yaml file if running frequently

3. **Wait for rate limit reset**
   - Check the "Rate limit reset:" timestamp in logs
   - Rate limits reset exactly 60 minutes after first request

### Debugging Tips

1. **Enable Debug Logging**

   ```yaml
   # In your repository settings
   Secrets → Actions → Add secret
   Name: ACTIONS_STEP_DEBUG
   Value: true
   ```

2. **Check Action Logs**
   - Look for info messages about which repository was found/not found
   - Check for warnings about skipped YAML entries
   - Review error messages for specific failure reasons

3. **Validate YAML File Locally**

   ```bash
   # Check YAML syntax
   yamllint runs-on-mapping.yaml

   # Or use Python
   python -c "import yaml; yaml.safe_load(open('runs-on-mapping.yaml'))"
   ```

4. **Test with Simple Configuration**
   ```yaml
   # Minimal test configuration
   ubuntu-latest:
     - test-repo
   ```

### Getting Help

If you encounter issues not covered here:

1. Check the
   [GitHub Issues](https://github.com/wsandersvc/select-runs-on-action/issues)
   for similar problems
2. Review the action logs for specific error messages
3. Open a new issue with:
   - Full error message
   - Relevant action configuration (sanitized, no secrets)
   - Steps to reproduce
   - Expected vs actual behavior
