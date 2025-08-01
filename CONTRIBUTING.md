# Contributing to Claude Code UI

First off, thank you for considering contributing to Claude Code UI! It's people like you that make Claude Code UI such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and expected**
- **Include screenshots if possible**
- **Include your environment details**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing code style
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- Rust >= 1.70.0
- Git

### Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/claude-code-ui.git
   cd claude-code-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   cd vibe-kanban/backend && cargo build && cd ../..
   ```

3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Start development servers:
   ```bash
   npm run dev
   ```

### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue with..."
   git commit -m "docs: update README"
   ```

3. Run tests:
   ```bash
   npm test
   npm run lint
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Create a Pull Request

## Coding Standards

### JavaScript/TypeScript

- Use ESLint configuration provided
- Follow Prettier formatting rules
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer functional components in React
- Use hooks instead of class components

Example:
```javascript
/**
 * Sends a message to Claude
 * @param {string} message - The message to send
 * @param {string} projectPath - The project path
 * @returns {Promise<string>} The response from Claude
 */
export async function sendMessage(message, projectPath) {
  // Implementation
}
```

### Rust

- Follow Rust naming conventions
- Use `cargo fmt` before committing
- Run `cargo clippy` and fix warnings
- Add documentation comments
- Write unit tests for new functionality

Example:
```rust
/// Handles task creation requests
/// 
/// # Arguments
/// * `task` - The task to create
/// 
/// # Returns
/// * `Result<Task, Error>` - The created task or error
pub async fn create_task(task: NewTask) -> Result<Task, Error> {
    // Implementation
}
```

### CSS/Styling

- Use Tailwind CSS utility classes
- Follow mobile-first approach
- Maintain consistent spacing
- Use CSS modules for component-specific styles
- Support both light and dark themes

### Git Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions or corrections
- `chore:` - Maintenance tasks

Examples:
```
feat: add voice transcription to chat interface
fix: resolve websocket disconnection on mobile
docs: update installation guide for Windows users
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run Rust tests
cd vibe-kanban/backend && cargo test
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Write E2E tests for critical user flows
- Aim for >80% code coverage
- Use descriptive test names

Example:
```javascript
describe('ChatInterface', () => {
  it('should send message when Enter is pressed', async () => {
    // Test implementation
  });

  it('should show error when message fails to send', async () => {
    // Test implementation
  });
});
```

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments to new functions
- Update API documentation for endpoint changes
- Include inline comments for complex logic
- Add examples for new features

## Project Structure

```
claude-code-ui/
├── src/                 # React frontend
├── server/              # Node.js backend
├── vibe-kanban/         # Rust backend
├── docs/                # Documentation
├── scripts/             # Build scripts
└── tests/               # Test files
```

## Review Process

### What We Look For

- **Code Quality**: Clean, readable, and maintainable code
- **Testing**: Adequate test coverage
- **Documentation**: Clear comments and updated docs
- **Performance**: No significant performance regressions
- **Security**: No security vulnerabilities introduced
- **UI/UX**: Consistent with existing design patterns

### Review Timeline

- Initial review within 2-3 business days
- Follow-up reviews within 1-2 business days
- Feel free to ping if no response after 5 days

## Community

### Getting Help

- **Discord**: Join our [Discord server](https://discord.gg/claude-code-ui)
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Search existing issues before creating new ones

### Recognition

Contributors will be:
- Added to the Contributors section in README
- Mentioned in release notes
- Given credit in commit messages

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to:
- Open an issue with the `question` label
- Ask in our Discord server
- Start a GitHub Discussion

Thank you for contributing to Claude Code UI! 🎉