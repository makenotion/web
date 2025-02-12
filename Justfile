set shell := ["zsh", "-c"]

alias up := update

[private]
@help:
  just --list

# Install dependencies
install:
	pnpm install --child-concurrency=10

# Fix deps, lint, format, etc.
[no-cd]
fix *flags:
  bun runx fix {{flags}}

# Run tests
[no-cd]
test *flags:
  bun run test:ci

[no-cd]
build:
  bun turbo build

# Update things in the repo
update *flags:
  bun runx update {{flags}}
