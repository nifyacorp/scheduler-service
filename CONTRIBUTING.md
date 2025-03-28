# Contributing to NIFYA Scheduler Service

Thank you for considering contributing to the NIFYA Scheduler Service!

## Development Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Push your branch and submit a pull request

## Code Style

We use ESLint and Prettier to maintain code quality. Before submitting a PR:

```bash
# Format code
npm run format

# Run linting
npm run lint
```

## Commit Message Format

We follow conventional commits format:

```
type(scope): subject

body
```

Types include:
- feat: A new feature
- fix: A bug fix
- docs: Documentation changes
- style: Changes that don't affect the code's meaning
- refactor: Code change that neither fixes a bug nor adds a feature
- perf: Performance improvements
- test: Adding missing tests
- chore: Changes to the build process or auxiliary tools

## Pull Request Process

1. Update the README.md with details of changes if necessary
2. Update the documentation if necessary
3. The PR should work in all supported Node.js versions
4. PRs should be reviewed by at least one maintainer

## Adding Tasks

To add a new scheduled task:

1. Create a new file in the `src/tasks` directory
2. Implement the task following the existing task pattern
3. Register the task in `src/tasks/index.js`
4. Add tests for your task in the `test/tasks` directory

## Security

- Never commit secrets or credentials
- Use Secret Manager for sensitive information
- Validate all inputs using schemas
- Sanitize any data used in logs or error messages