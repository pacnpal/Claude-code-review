# Claude Code Review Action

![GitHub](https://img.shields.io/github/license/pacnpal/claude-code-review)
![GitHub Actions Workflow Status](https://img.shields.io/badge/actions-passing-brightgreen)

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
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Features

- 🤖 **AI-Powered Reviews**: Leverages Claude Sonnet 4.5 for intelligent code analysis
- 🔍 **Comprehensive Analysis**: Examines code changes in pull requests thoroughly
- 💡 **Detailed Feedback**: Provides actionable feedback on code quality and structure
- 🐛 **Bug Detection**: Identifies potential issues and suggests improvements
- 🔒 **Security Scanning**: Checks for security vulnerabilities and risks
- ⚡ **Performance Insights**: Highlights performance implications of code changes
- 📋 **Best Practices**: Ensures adherence to coding standards and best practices
- 🎯 **Severity Ratings**: Categorizes issues by severity (Critical/High/Medium/Low)

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

3. **Set Permissions** (if needed):
   - Ensure your workflow has proper permissions (see Usage example above)
   - Required permissions: `contents: read` and `pull-requests: write`

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `anthropic-key` | Anthropic API key for Claude | Yes | N/A |
| `pr-number` | Pull request number to review | Yes | N/A |

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
