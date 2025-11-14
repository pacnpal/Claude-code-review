# Claude Code Review Action

![GitHub](https://img.shields.io/github/license/pacnpal/claude-code-review)
![GitHub Actions Workflow Status](https://img.shields.io/badge/actions-passing-brightgreen)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204.5-blue)
![Node](https://img.shields.io/badge/node-20-green)

A GitHub Action that performs automated code reviews using Claude Sonnet 4.5, Anthropic's latest AI model for code analysis.

## Why Use Claude Code Review?

- **Instant Feedback**: Get AI-powered code reviews immediately on every pull request
- **Consistent Quality**: Apply consistent review standards across your entire codebase
- **Save Time**: Catch common issues before human review, allowing reviewers to focus on architecture and logic
- **Learn & Improve**: Get educational feedback that helps developers improve their coding skills
- **24/7 Availability**: Reviews happen automatically, even outside business hours

## Table of Contents

- [Why Use Claude Code Review?](#why-use-claude-code-review)
- [Features](#features)
- [Usage](#usage)
- [Setup](#setup)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Review Format](#review-format)
- [Technical Details](#technical-details)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [FAQ](#frequently-asked-questions)
- [License](#license)
- [Support](#support)

## Features

- 🤖 **AI-Powered Reviews**: Leverages Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) for intelligent code analysis
- 🔍 **Comprehensive Analysis**: Examines code changes in pull requests thoroughly
- 💡 **Detailed Feedback**: Provides actionable feedback on code quality and structure
- 🐛 **Bug Detection**: Identifies potential issues and suggests improvements
- 🔒 **Security Scanning**: Checks for security vulnerabilities and risks
- ⚡ **Performance Insights**: Highlights performance implications of code changes
- 📋 **Best Practices**: Ensures adherence to coding standards and best practices
- 🎯 **Severity Ratings**: Categorizes issues by severity (Critical/High/Medium/Low)
- 🔄 **Automatic Retries**: Built-in retry logic with exponential backoff for reliability
- ⏱️ **Rate Limit Handling**: Automatically manages API rate limits

## Usage

Add this to your GitHub workflow file (e.g. `.github/workflows/review.yml`):

```yaml
name: Claude Code Review

permissions:
  contents: read
  pull-requests: write

on:
  # Run on new/updated PRs
  pull_request:
    types: [opened, reopened, synchronize]
  
  # Allow manual triggers for existing PRs
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'Pull Request Number'
        required: true
        type: string

jobs:
  code-review:
    runs-on: ubuntu-latest
    environment: development_environment
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Run Claude Review
        uses: pacnpal/claude-code-review@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
          pr-number: ${{ github.event.pull_request.number || inputs.pr_number }}
```
### Manual Trigger

For existing pull requests, you can manually trigger the review:

1. Click on "Claude Code Review" Action under the Actions tab
2. Click "Run Workflow"
3. Fill in the branch and pull request number
4. Click "Run Workflow"

### Disabling Auto-Review

You can disable automatic reviews and only use manual triggers by setting `auto-review: false`:

```yaml
- name: Run Claude Review
  uses: pacnpal/claude-code-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
    pr-number: ${{ github.event.pull_request.number || inputs.pr_number }}
    auto-review: false  # Disables automatic reviews
```

You can also make it conditional based on labels or other criteria:

```yaml
- name: Run Claude Review
  uses: pacnpal/claude-code-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
    pr-number: ${{ github.event.pull_request.number || inputs.pr_number }}
    auto-review: ${{ contains(github.event.pull_request.labels.*.name, 'needs-review') }}
```

## Setup

### Prerequisites

- A GitHub repository
- An Anthropic API key ([Get one here](https://console.anthropic.com/))
- GitHub Actions enabled in your repository

### Configuration Steps

1. **Add Anthropic API Key**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key
   - Click "Add secret"

2. **GitHub Token**:
   - The `GITHUB_TOKEN` is automatically provided by GitHub Actions
   - No additional configuration needed

3. **Set Permissions**:
   - Ensure your workflow has proper permissions (see Usage example above)
   - Required permissions: `contents: read` and `pull-requests: write`
   - For organization repositories, you may need to enable workflows to create/approve pull requests in Settings

4. **Optional: Environment Protection**:
   - For additional security, create a GitHub Environment (e.g., `development_environment`)
   - Add `ANTHROPIC_API_KEY` as an environment secret instead of repository secret
   - This provides additional control and approval gates for sensitive operations

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `anthropic-key` | Anthropic API key for Claude | Yes | N/A |
| `pr-number` | Pull request number to review | Yes | N/A |
| `auto-review` | Enable automatic code reviews (set to `false` to skip) | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `diff_size` | Size of the relevant code changes |
| `review` | Generated code review content |

## Review Format

The action provides detailed code reviews covering:

1. Potential conflicts with existing codebase
2. Code correctness and potential bugs  
3. Security vulnerabilities and risks
4. Performance implications
5. Maintainability and readability issues
6. Adherence to best practices
7. Suggestions for improvements

Each issue found includes:
- Clear problem explanation
- Severity rating (Critical/High/Medium/Low)
- Specific recommendations
- Code examples where helpful

## Technical Details

### Model Configuration

- **Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Max Tokens**: 4096 tokens per review
- **Temperature**: 0.7 for balanced creativity and consistency
- **Context**: 10 lines of context around each change (git diff -U10)

### Reliability Features

**Automatic Retry Logic**:
- Network failures are automatically retried up to 4 times
- Exponential backoff strategy (2s, 4s, 8s, 16s delays)
- Non-retryable errors (401, 403, 400) fail immediately

**Timeout Protection**:
- API requests timeout after 2 minutes
- Prevents hanging workflows on slow responses

**Rate Limit Handling**:
- Automatically respects `Retry-After` headers
- Graceful handling of 429 rate limit responses

### Diff Size Limits

- **Maximum Diff Size**: ~100KB (100,000 bytes)
- Large diffs are automatically truncated with a notice
- Helps stay within API token limits and ensures fast reviews

## Limitations

- **Diff Size**: Changes larger than ~100KB will be truncated
- **Review Timeout**: Reviews exceeding 2 minutes will timeout
- **PR State**: Can review closed PRs, but a warning is logged
- **File Types**: All text-based files are analyzed; binary files in diffs are ignored
- **API Costs**: Each review consumes Anthropic API credits based on diff size

## Troubleshooting

### Common Issues

**Issue**: "Failed to get PR details"
- **Solution**: Ensure `GITHUB_TOKEN` has `pull-requests: read` permission
- **Solution**: Verify the PR number is correct

**Issue**: "anthropic-key does not match expected format"
- **Solution**: Verify your API key starts with `sk-ant-`
- **Solution**: Check for extra spaces or newlines in the secret

**Issue**: "Diff is empty - no changes found"
- **Solution**: This is expected when comparing identical commits
- **Solution**: Ensure the PR has actual code changes

**Issue**: "Rate limited" or 429 errors
- **Solution**: The action will automatically retry with backoff
- **Solution**: Consider reducing review frequency if you hit limits often
- **Solution**: Check your Anthropic API rate limits and quotas

**Issue**: "API request timed out"
- **Solution**: This may happen with very large diffs (>100KB)
- **Solution**: Break large PRs into smaller, more focused changes
- **Solution**: The action will automatically truncate diffs that are too large

**Issue**: Action fails with authentication errors
- **Solution**: Verify `ANTHROPIC_API_KEY` is set correctly in repository secrets
- **Solution**: Ensure the API key is active and not expired
- **Solution**: Check that your Anthropic account has available credits

### Debug Mode

To enable verbose logging, add this to your workflow:

```yaml
- name: Run Claude Review
  uses: pacnpal/claude-code-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
    pr-number: ${{ github.event.pull_request.number }}
  env:
    ACTIONS_STEP_DEBUG: true
```

## Example Review

```markdown
# Claude Code Review

1. **Potential conflicts with existing codebase**:
   - No apparent conflicts identified
   
2. **Code correctness and potential bugs**:
   - **Medium Severity**: Potential null pointer in user handling
   - Recommendation: Add null check before accessing user object
   
3. **Security vulnerabilities and risks**: 
   - **High Severity**: SQL injection vulnerability in query construction
   - Recommendation: Use parameterized queries
```

## Development

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pacnpal/claude-code-review.git
   cd claude-code-review
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Make your changes**:
   - Edit `action.js` for core functionality
   - The built output goes to `dist/index.js`

4. **Build the action**:
   ```bash
   npm run build
   ```
   This compiles `action.js` into `dist/index.js` using [@vercel/ncc](https://github.com/vercel/ncc)

5. **Run tests**:
   ```bash
   npm test
   ```

### Project Structure

```
claude-code-review/
├── action.js          # Main action logic
├── action.yml         # Action metadata
├── dist/              # Built output (committed)
│   └── index.js       # Compiled action
├── package.json       # Dependencies
└── README.md          # Documentation
```

### Testing Changes

- Test your changes in a fork before submitting a PR
- Use the `workflow_dispatch` trigger for manual testing
- Ensure `npm run build` completes without errors
- Verify all tests pass with `npm test`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Frequently Asked Questions

### How much does it cost?

The action is free, but you'll need an Anthropic API subscription. Costs vary based on:
- Diff size (larger diffs = more tokens)
- Review frequency (more PRs = more API calls)
- Current Claude API pricing (check [Anthropic's pricing](https://www.anthropic.com/pricing))

Typical small PR review (~1-2KB diff) costs a few cents.

### Can I use this with private repositories?

Yes! The action works with both public and private repositories. Just ensure:
- GitHub Actions is enabled for your repository
- You've added the `ANTHROPIC_API_KEY` secret
- Workflow permissions are properly configured

### Will this slow down my CI/CD pipeline?

The action runs asynchronously and doesn't block other checks. Typical review times:
- Small PRs (<10KB): 10-30 seconds
- Medium PRs (10-50KB): 30-60 seconds
- Large PRs (50-100KB): 60-120 seconds

You can also use `auto-review: false` to only run reviews on-demand.

### Can I customize the review criteria?

Currently, the review criteria are built into the action. Future versions may support custom prompts. You can:
- Fork the repository and modify `action.js` to customize the prompt
- Use the review as a baseline and add custom checks with other actions

### Does it support languages other than English?

The action's prompts are in English, but Claude can analyze code in any programming language. Review comments will be in English.

### What happens if my diff is too large?

Diffs larger than ~100KB are automatically truncated. A notice is added to the review indicating truncation. For large PRs:
- Consider breaking them into smaller, focused changes
- The most important changes (first ~100KB) will still be reviewed

### Can I run this on forked PRs?

Yes, but be cautious with secrets. Use GitHub's `pull_request_target` event with proper security:
- Don't expose secrets to untrusted code
- Consider requiring manual approval for fork PRs
- Review GitHub's [security hardening guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

### How do I prevent reviews on draft PRs?

Add a condition to your workflow:

```yaml
jobs:
  code-review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    # ... rest of job
```

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Support

### Getting Help

- 🐛 **Bug Reports**: [Open an issue](https://github.com/pacnpal/claude-code-review/issues/new) with details and reproduction steps
- 💡 **Feature Requests**: [Create an issue](https://github.com/pacnpal/claude-code-review/issues/new) describing your use case
- 🤝 **Contributions**: Submit a PR following our contribution guidelines
- 📧 **Questions**: Open a discussion or contact the maintainers

### Resources

- [Anthropic Claude Documentation](https://docs.anthropic.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Action Marketplace Listing](https://github.com/marketplace/actions/claude-code-review)

## Acknowledgments

Built with:
- [Anthropic Claude API](https://www.anthropic.com/claude) - AI-powered code analysis
- [GitHub Actions](https://github.com/features/actions) - CI/CD automation platform
- [@actions/core](https://github.com/actions/toolkit/tree/main/packages/core) - GitHub Actions toolkit
- [@vercel/ncc](https://github.com/vercel/ncc) - Node.js bundler

---

**Made with ❤️ by PacNPal** | [Report Bug](https://github.com/pacnpal/claude-code-review/issues) | [Request Feature](https://github.com/pacnpal/claude-code-review/issues)
