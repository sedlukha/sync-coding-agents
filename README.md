# sync-coding-agents

[![CI](https://github.com/sedlukha/sync-coding-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/sedlukha/sync-coding-agents/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sync-coding-agents.svg)](https://www.npmjs.com/package/sync-coding-agents)
[![npm downloads](https://img.shields.io/npm/dm/sync-coding-agents.svg)](https://www.npmjs.com/package/sync-coding-agents)
[![license](https://img.shields.io/npm/l/sync-coding-agents.svg)](LICENSE)

Sync `.agents/` (single source of truth) into `.claude/` and `.github/` so [Claude Code](https://docs.claude.com/en/docs/claude-code) and [GitHub Copilot](https://docs.github.com/en/copilot) read the same agent and skill definitions. Uses **symlinks for Claude** and **stripped copies for Copilot** (which doesn't follow symlinks reliably and doesn't understand Claude-specific frontmatter).

## Why?

Claude Code reads custom agents from `.claude/agents/` and skills from `.claude/skills/`. GitHub Copilot reads agent instructions from `.github/agents/` and `.github/copilot-instructions.md`. Maintaining the same definitions in two or three places is error-prone.

This CLI lets you author everything once under `.agents/` and atomically rewrite the consumer directories — symlinks where they work, copies where they don't.

## Installation

Run without installing:

```bash
npx sync-coding-agents
```

Or add as a dev dependency:

```bash
npm install -D sync-coding-agents
```

Then wire it into `package.json`:

```json
{
  "scripts": {
    "agents:sync": "sync-coding-agents"
  }
}
```

Requires Node.js ≥ 18 and a filesystem that supports symlinks. On Windows that means Developer Mode or running the shell as Administrator.

## Usage

From the root of your repo:

```bash
npx sync-coding-agents
```

Or pass an explicit project root:

```bash
npx sync-coding-agents /path/to/repo
```

### Expected source layout

The CLI assumes you author agents and skills in `.agents/`:

```
.agents/
├── agents/
│   ├── design-partner.md
│   ├── code-review-expert.md
│   └── ...                  # one .md file per agent
└── skills/
    ├── react-rules/
    │   └── SKILL.md
    ├── typescript-rules/
    │   └── SKILL.md
    └── ...                  # one directory per skill

AGENTS.md                    # optional, shared top-level instructions
```

`AGENTS.md` at the repo root is treated as the canonical instruction file for both Claude Code (`CLAUDE.md`) and GitHub Copilot (`.github/copilot-instructions.md`).

## What it produces

| Source                  | Target                              | Mechanism                             |
| ----------------------- | ----------------------------------- | ------------------------------------- |
| `.agents/skills/*/`     | `.claude/skills/*`                  | Directory symlink (one per skill)     |
| `.agents/agents/*.md`   | `.claude/agents/*.md`               | File symlink (one per agent)          |
| `.agents/agents/*.md`   | `.github/agents/*.agent.md`         | Copy with Claude-only fields stripped |
| `AGENTS.md`             | `CLAUDE.md`                         | Symlink                               |
| `AGENTS.md`             | `.github/copilot-instructions.md`   | Symlink                               |

### Frontmatter stripped for GitHub Copilot copies

These keys are removed from the Copilot-facing `.agent.md` copies — they're specific to Claude Code's runtime and not part of the GitHub agent format:

- `color`
- `skills`
- `permissionMode`
- `model`

Continuation lines (indented YAML values) are stripped too, so multi-line fields don't leak through.

## How the sync works

For every target directory the CLI performs a two-phase operation:

1. **Delete** every existing symlink (or, for `.github/agents/`, every existing `*.agent.md` file) in the target directory.
2. **Recreate** entries from the matching source directory.

Non-symlink files in `.claude/agents/` and `.claude/skills/` are **left untouched**, so it's safe to keep additional Claude-only files alongside the synced ones. In `.github/agents/`, only `*.agent.md` files are managed — any other content is preserved.

Symlinks use **relative paths** computed at runtime with `path.relative(target, source)`, so they remain valid when the repo is cloned to a different absolute path.

## When to run

Run the sync after any of:

- Adding, renaming, or deleting an agent file under `.agents/agents/`
- Adding, renaming, or deleting a skill directory under `.agents/skills/`
- Creating or removing `AGENTS.md` at the repo root

If you skip this step, Claude Code and Copilot won't see your changes.

## Tips

- **Commit the symlinks.** Git tracks symlinks as their target path, so the pointers travel with the repo. The actual content lives in `.agents/` and is versioned normally.
- **Don't commit `.github/agents/*.agent.md` by hand.** They're regenerated on every run; treat them like build output.
- **Wire into precommit or CI** to be sure the synced consumer files never drift from `.agents/`.

## License

MIT
