# Contributing Guide

Thank you for contributing to this project! To keep the repository clean and maintainable, please follow the guidelines below.

---

# Development Workflow

1. Create a new branch from `develop`.
2. Implement your changes.
3. Ensure all tests pass.
4. Commit using the Conventional Commits format.
5. Push your branch.
6. Open a Pull Request (PR) targeting `develop`.
7. Wait for code review and approval before merging.

---

# Branch Naming Convention

Use lowercase letters only.

```
<type>/<short-description>
```

### Types

| Type | Description |
|------|-------------|
| `feature` | New feature |
| `fix` | Bug fix |
| `hotfix` | Critical production fix |
| `refactor` | Code refactoring |
| `docs` | Documentation changes |
| `test` | Test-related changes |
| `chore` | Build, dependency, configuration |
| `ci` | CI/CD changes |
| `perf` | Performance improvements |

### Examples

```
feature/user-authentication
feature/grpc-order-service
fix/login-timeout
hotfix/payment-validation
refactor/user-module
docs/update-readme
test/auth-service
chore/update-eslint
ci/github-actions
perf/cache-product-service
```

### Rules

- Use lowercase only.
- Separate words using hyphens (`-`).
- Keep branch names short and descriptive.
- Do not include spaces.
- Do not use personal names.

✅ Good

```
feature/order-api
fix/jwt-refresh
refactor/payment-service
```

❌ Bad

```
NewFeature
Feature/Login
john-feature
feature_login
test123
```

---

# Commit Message Convention

This project follows the Conventional Commits specification.

```
<type>: <description>
```

### Types

```
feat
fix
docs
style
refactor
test
build
ci
perf
chore
revert
```

### Examples

```
feat: add gRPC order service
fix: resolve JWT expiration issue
docs: update installation guide
refactor: split auth middleware
test: add user controller tests
ci: add docker image publishing
chore: upgrade dependencies
```

---

# Pull Request Rules

## PR Title

Follow Conventional Commits.

Example:

```
feat: implement authentication service
```

## PR Checklist

- [ ] Code builds successfully
- [ ] Tests pass
- [ ] No unnecessary files included
- [ ] Documentation updated (if required)
- [ ] Breaking changes documented
- [ ] Self-reviewed before requesting review

---

# Coding Standards

- Follow the project's formatter and linter.
- Do not commit generated files unless required.
- Keep functions small and focused.
- Avoid commented-out code.
- Remove debugging statements before committing.
- Write meaningful variable and function names.

---

# Testing

Before opening a PR, run:

```bash
npm install
npm run lint
npm run test
npm run build
```

Or the equivalent commands for the service you modified.

---

# Repository Structure

```
.
├── app/
	|── backend/
	|── frontend/
```

---

# Code Review Guidelines

Every Pull Request should:

- Have a clear description.
- Solve one logical problem.
- Be as small as reasonably possible.
- Include screenshots for UI changes.
- Include migration notes if database changes are introduced.

---

# Do Not

- Commit directly to `main`.
- Force push shared branches.
- Commit secrets, passwords, or API keys.
- Commit `.env` files.
- Commit large binaries unless necessary.
- Ignore failing CI checks.

---

# Git Ignore Recommendations

Ensure the following are ignored:

```
node_modules/
.env
.env.*
coverage/
dist/
build/
*.log
```

---

# Versioning

This project follows Semantic Versioning.

```
MAJOR.MINOR.PATCH
```

Example:

```
2.4.1
```

---

# Questions

If you are unsure about anything:

Feel free to ask team mate 😊
