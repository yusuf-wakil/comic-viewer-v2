# Contributing to OpenComic V2

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/yusuf-wakil/comic-viewer-v2.git
cd comic-viewer-v2
npm install
npm run dev
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run tests: `npm run test`
4. Run type checking: `npm run typecheck`
5. Open a pull request against `main`

## Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `chore/short-description` — maintenance, deps, config

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Describe what changed and why in the PR description
- Link any related issues

## Reporting Bugs

Open a GitHub issue with:

- Steps to reproduce
- Expected vs actual behavior
- OS and app version

## Code Style

- TypeScript strict mode — no `any`
- Prettier and ESLint are enforced on commit
- Prefer small, focused components and functions

## License

By contributing, you agree your changes will be licensed under the [MIT License](LICENSE).
