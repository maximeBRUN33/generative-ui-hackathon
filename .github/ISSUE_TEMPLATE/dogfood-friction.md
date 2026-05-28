---
name: Dogfood friction
about: Log a friction point hit while following the documented hackathon paths (AGENTS.md, HACKATHON.md, pnpm scripts, in-tree READMEs). One issue per friction.
title: "[friction] <one-line summary>"
labels: ["dogfood-friction"]
assignees: []
---

<!--
Use this template ONLY for friction encountered while following a DOCUMENTED
path (AGENTS.md, HACKATHON.md, pnpm scripts, in-tree READMEs). For "I had to
read the source" friction, that itself is the friction — log it.

Fill every field below. Match the FRICTION.md row format from plan §0.7 so
this issue can be auto-rolled-up.
-->

## Severity

<!-- Pick exactly one. Also add the matching `severity:*` label. -->

- [ ] P0 — blocker (the documented path fails outright; the hackathon attendee cannot continue)
- [ ] P1 — pain (the documented path works only after a workaround / extra step)
- [ ] P2 — polish (the documented path works, but cost time or confidence; nice-to-fix)

## Area

<!-- Pick one. Also add the matching `area:*` label. -->

- [ ] `agent-py` — Python agent (`agent/`)
- [ ] `catalog-ts` — TS catalog / renderer wiring (`src/app/api/copilotkit/`, schema arrays)
- [ ] `scripts` — pnpm scripts (`scripts/`, `package.json`)
- [ ] `docs` — AGENTS.md, HACKATHON.md, in-tree READMEs
- [ ] `ax-rules` — AI-assistant guidance (slash command vocab, anti-patterns, skills)

## Target persona

<!-- Who hits this? Pick one or more. Also add the matching `target-persona:*` label(s). -->

- [ ] `claude-code` — Claude Code users
- [ ] `gemini-cli` — Gemini CLI users
- [ ] `cursor` — Cursor / Windsurf / Codex CLI / Aider users
- [ ] `human-only` — A human reading the docs without an AI assistant

## Encountered while

<!--
The exact documented step you were following. Quote AGENTS.md, HACKATHON.md,
or the pnpm script name. Example:
  "Following AGENTS.md §Customization seams #4 (Add an A2UI widget), step:
   `pnpm new-widget recipe-card`"
-->

## What I tried (the documented path)

<!--
The documented commands / file edits, in order. Use a fenced block.
-->

```text

```

## What happened (error / confusion)

<!--
Paste the actual error message, ambiguous doc paragraph, or screenshot.
If it's an error, include the full stderr — do NOT paraphrase.
-->

```text

```

## What I wanted (right outcome)

<!--
One sentence: what should the documented path have produced?
-->

## Suggested fix (if obvious)

<!--
Optional. A diff sketch, doc rewrite, script change, or "this needs an ADR."
Leave blank if not obvious — the friction is still valid.
-->

## Reproduction context

- OS: <!-- e.g. macOS 15.4 / Ubuntu 24.04 / Windows 11 + WSL -->
- Node: <!-- `node -v` -->
- pnpm: <!-- `pnpm -v` -->
- Python: <!-- `python3 --version` -->
- uv: <!-- `uv --version` -->
- AI assistant (if any): <!-- e.g. Claude Code 1.x / Gemini CLI / Cursor -->
- Branch / commit: <!-- `git rev-parse --short HEAD` -->

---

<!--
Required labels on this issue (add via the sidebar or `gh issue edit`):
  dogfood-friction
  severity:P0-blocker | severity:P1-pain | severity:P2-polish
  area:agent-py | area:catalog-ts | area:scripts | area:docs | area:ax-rules
  target-persona:claude-code | target-persona:gemini-cli | target-persona:cursor | target-persona:human-only

Required milestone (add via the sidebar): hackathon-readiness-jun13
-->
