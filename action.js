// action.js
const core = require('@actions/core');
const github = require('@actions/github');
const { exec } = require('@actions/exec');

// Constants for retry logic
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 2000;
const MAX_DIFF_SIZE = 100000; // ~100KB to stay well under API limits
const API_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {string} operation - Description of operation for logging
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, operation, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        core.info(`Retry attempt ${attempt}/${maxRetries} for ${operation} after ${backoffMs}ms`);
        await sleep(backoffMs);
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication or validation errors
      if (error.status === 401 || error.status === 403 || error.status === 400) {
        core.error(`${operation} failed with non-retryable error: ${error.message}`);
        throw error;
      }

      if (attempt < maxRetries) {
        core.warning(`${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
      } else {
        core.error(`${operation} failed after ${maxRetries + 1} attempts`);
      }
    }
  }

  throw lastError;
}

/**
 * Validate input parameters
 * @param {string} token - GitHub token
 * @param {string} anthropicKey - Anthropic API key
 * @param {string|number} prNumber - PR number
 */
function validateInputs(token, anthropicKey, prNumber) {
  if (!token || token.trim() === '') {
    throw new Error('github-token is required and cannot be empty');
  }

  if (!anthropicKey || anthropicKey.trim() === '') {
    throw new Error('anthropic-key is required and cannot be empty');
  }

  if (!anthropicKey.startsWith('sk-ant-')) {
    core.warning('anthropic-key does not match expected format (should start with sk-ant-)');
  }

  const prNum = parseInt(prNumber);
  if (isNaN(prNum) || prNum <= 0) {
    throw new Error(`Invalid PR number: ${prNumber}. Must be a positive integer.`);
  }

  core.info('✓ Input validation passed');
  return prNum;
}

/**
 * Get PR details from GitHub API with retry logic
 * @param {Object} octokit - GitHub API client
 * @param {Object} context - GitHub context
 * @param {number} prNumber - PR number
 * @returns {Promise<Object>} PR details
 */
async function getPRDetails(octokit, context, prNumber) {
  core.startGroup('Fetching PR details');

  try {
    core.info(`Getting details for PR #${prNumber}`);

    const { data: pr } = await retryWithBackoff(
      async () => await octokit.rest.pulls.get({
        ...context.repo,
        pull_number: prNumber
      }),
      'Get PR details'
    );

    const result = {
      number: pr.number,
      base: {
        sha: pr.base.sha,
        ref: pr.base.ref
      },
      head: {
        sha: pr.head.sha,
        ref: pr.head.ref
      },
      title: pr.title,
      state: pr.state
    };

    core.info(`✓ Retrieved PR #${result.number}: "${result.title}"`);
    core.info(`  Base: ${result.base.ref} (${result.base.sha.substring(0, 7)})`);
    core.info(`  Head: ${result.head.ref} (${result.head.sha.substring(0, 7)})`);
    core.debug(`PR state: ${result.state}`);

    return result;
  } catch (error) {
    core.error(`Failed to get PR details: ${error.message}`);
    throw new Error(`Failed to get PR details for #${prNumber}: ${error.message}`);
  } finally {
    core.endGroup();
  }
}

/**
 * Setup git configuration with retry logic
 * @returns {Promise<void>}
 */
async function setupGitConfig() {
  core.startGroup('Setting up Git configuration');

  try {
    core.info('Configuring git to fetch PR refs...');
    await retryWithBackoff(
      async () => await exec('git', ['config', '--local', '--add', 'remote.origin.fetch', '+refs/pull/*/head:refs/remotes/origin/pr/*']),
      'Git config fetch refs'
    );

    core.info('Fetching from origin...');
    await retryWithBackoff(
      async () => await exec('git', ['fetch', 'origin']),
      'Git fetch origin'
    );

    core.info('Setting git user identity...');
    await exec('git', ['config', '--global', 'user.name', 'claude-code-review[bot]']);
    await exec('git', ['config', '--global', 'user.email', 'claude-code-review[bot]@users.noreply.github.com']);

    core.info('✓ Git configuration completed');
  } catch (error) {
    core.error(`Git configuration failed: ${error.message}`);
    throw new Error(`Failed to configure git: ${error.message}`);
  } finally {
    core.endGroup();
  }
}

/**
 * Generate diff between two commits with size validation
 * @param {string} baseSha - Base commit SHA
 * @param {string} headSha - Head commit SHA
 * @returns {Promise<string>} Diff content
 */
async function getDiff(baseSha, headSha) {
  core.startGroup('Generating diff');

  let diffContent = '';
  let stderr = '';

  try {
    core.info(`Generating diff between ${baseSha.substring(0, 7)} and ${headSha.substring(0, 7)}`);

    // Get the full diff with context
    await exec('git', ['diff', '-U10', baseSha, headSha], {
      listeners: {
        stdout: (data) => {
          diffContent += data.toString();
        },
        stderr: (data) => {
          stderr += data.toString();
        }
      }
    });

    if (stderr) {
      core.debug(`Git diff stderr: ${stderr}`);
    }

    const diffSize = Buffer.byteLength(diffContent, 'utf8');
    core.info(`✓ Diff generated: ${diffSize} bytes`);

    if (diffSize === 0) {
      core.warning('Diff is empty - no changes found');
      return '';
    }

    if (diffSize > MAX_DIFF_SIZE) {
      core.warning(`Diff size (${diffSize} bytes) exceeds maximum (${MAX_DIFF_SIZE} bytes)`);
      const truncated = diffContent.substring(0, MAX_DIFF_SIZE);
      const lines = truncated.split('\n').length;
      core.warning(`Diff truncated to ${MAX_DIFF_SIZE} bytes (~${lines} lines)`);
      return truncated + '\n\n[... diff truncated due to size ...]';
    }

    const lines = diffContent.split('\n').length;
    core.info(`Diff contains ${lines} lines`);

    return diffContent;
  } catch (error) {
    core.error(`Failed to generate diff: ${error.message}`);
    if (stderr) {
      core.error(`Git stderr: ${stderr}`);
    }
    throw new Error(`Failed to generate diff: ${error.message}`);
  } finally {
    core.endGroup();
  }
}

/**
 * Create fetch with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, options, timeout = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analyze code diff with Claude API including retry logic and proper error handling
 * @param {string} diffContent - Code diff to analyze
 * @param {string} anthropicKey - Anthropic API key
 * @returns {Promise<string|null>} Code review text
 */
async function analyzeWithClaude(diffContent, anthropicKey) {
  core.startGroup('Analyzing with Claude AI');

  if (!diffContent || !diffContent.trim()) {
    core.warning('Diff content is empty, skipping analysis');
    core.endGroup();
    return null;
  }

  const prompt = `You are performing a code review. Please analyze this code diff and provide a thorough review that covers:

1. Potential conflicts with existing codebase
2. Code correctness and potential bugs
3. Security vulnerabilities or risks
4. Performance implications
5. Maintainability and readability issues
6. Adherence to best practices and coding standards
7. Suggestions for improvements

For each issue found:
- Explain the problem clearly
- Rate the severity (Critical/High/Medium/Low)
- Provide specific recommendations for fixes
- Include code examples where helpful

- If no issues are found in a particular area, explicitly state that.
- If it's a dependency update, evaluate with strict scrutiny the implications of the change.
- No matter your findings, give a summary of the pull request.

Here is the code diff to review:

\`\`\`
${diffContent}
\`\`\``;

  try {
    core.info('Sending request to Claude API...');
    core.debug(`Prompt length: ${prompt.length} characters`);

    const review = await retryWithBackoff(async () => {
      const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          temperature: 0.7,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      }, API_TIMEOUT_MS);

      // Check HTTP status
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorText;
        } catch {
          errorMessage = errorText;
        }

        // Create error with status for retry logic
        const error = new Error(`API returned ${response.status}: ${errorMessage}`);
        error.status = response.status;

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            core.warning(`Rate limited. Retry after ${retryAfter} seconds`);
            error.retryAfter = parseInt(retryAfter) * 1000;
          }
        }

        throw error;
      }

      const data = await response.json();

      if (!data.content?.[0]?.text) {
        throw new Error(`Invalid API response: missing content. Response: ${JSON.stringify(data).substring(0, 200)}`);
      }

      return data.content[0].text;
    }, 'Claude API request', 3); // Use fewer retries for API calls

    const reviewLength = review.length;
    core.info(`✓ Received review from Claude: ${reviewLength} characters`);

    return review;
  } catch (error) {
    if (error.name === 'AbortError') {
      core.error(`Claude API request timed out after ${API_TIMEOUT_MS}ms`);
      throw new Error(`Claude API request timed out after ${API_TIMEOUT_MS / 1000} seconds`);
    }

    core.error(`Claude API error: ${error.message}`);
    throw new Error(`Failed to analyze with Claude: ${error.message}`);
  } finally {
    core.endGroup();
  }
}

/**
 * Post code review as a comment on the PR with retry logic
 * @param {Object} octokit - GitHub API client
 * @param {Object} context - GitHub context
 * @param {string} review - Review text
 * @param {number} prNumber - PR number
 * @returns {Promise<void>}
 */
async function postReview(octokit, context, review, prNumber) {
  core.startGroup('Posting review comment');

  try {
    core.info(`Posting review to PR #${prNumber}...`);
    core.debug(`Review length: ${review.length} characters`);

    // GitHub markdown handles most content correctly without escaping
    // Only ensure the review doesn't break the comment
    const body = `# 🤖 Claude Code Review\n\n${review}`;

    const comment = await retryWithBackoff(
      async () => await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: prNumber,
        body: body
      }),
      'Post review comment'
    );

    core.info(`✓ Review posted successfully`);
    core.debug(`Comment ID: ${comment.data.id}`);
    core.debug(`Comment URL: ${comment.data.html_url}`);

  } catch (error) {
    core.error(`Failed to post review comment: ${error.message}`);
    throw new Error(`Failed to post review: ${error.message}`);
  } finally {
    core.endGroup();
  }
}

/**
 * Main execution function
 */
async function run() {
  const startTime = Date.now();

  try {
    core.info('🚀 Starting Claude Code Review Action');
    core.info(`Node version: ${process.version}`);
    core.info(`Platform: ${process.platform}`);

    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const anthropicKey = core.getInput('anthropic-key', { required: true });
    let prNumber = core.getInput('pr-number');

    // Get PR number from event if not provided
    const context = github.context;
    if (!prNumber && context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request?.number;
    }

    // Validate inputs
    const validatedPrNumber = validateInputs(token, anthropicKey, prNumber);

    // Mask sensitive data in logs
    core.setSecret(anthropicKey);

    // Initialize GitHub client
    core.info('Initializing GitHub client...');
    const octokit = github.getOctokit(token);
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`Event: ${context.eventName}`);

    // Set up git configuration
    await setupGitConfig();

    // Get PR details
    const pr = await getPRDetails(octokit, context, validatedPrNumber);

    // Validate PR state
    if (pr.state === 'closed') {
      core.warning(`PR #${pr.number} is closed. Review will still be posted.`);
    }

    // Generate diff
    const diff = await getDiff(pr.base.sha, pr.head.sha);

    if (!diff || diff.trim() === '') {
      core.warning('No changes found in diff');
      core.setOutput('diff_size', '0');
      core.setOutput('review', 'No changes to review');
      core.info('✓ Action completed (no changes to review)');
      return;
    }

    const diffSize = Buffer.byteLength(diff, 'utf8');
    core.setOutput('diff_size', diffSize.toString());

    // Analyze with Claude
    const review = await analyzeWithClaude(diff, anthropicKey);

    if (!review) {
      core.warning('No review generated by Claude');
      core.setOutput('review', '');
      core.info('✓ Action completed (no review generated)');
      return;
    }

    // Post review
    await postReview(octokit, context, review, pr.number);

    // Set outputs
    core.setOutput('review', review);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    core.info(`✓ Claude Code Review completed successfully in ${duration}s`);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    core.error(`✗ Action failed after ${duration}s`);
    core.error(`Error: ${error.message}`);

    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }

    core.setFailed(error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  core.error('Unhandled Rejection at:', promise);
  core.error('Reason:', reason);
  core.setFailed(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  core.error('Uncaught Exception:', error);
  core.setFailed(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

run();
