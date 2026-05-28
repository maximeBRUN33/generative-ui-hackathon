#!/usr/bin/env bash
# scripts/setup-dogfood-labels.sh — Idempotently create the GitHub labels used
# by the `dogfood-friction` issue template (.github/ISSUE_TEMPLATE/).
#
# Why this exists: the hackathon dogfood policy (PLAN.md §0.7) requires every
# friction issue to carry consistent metadata so the roll-up to FRICTION.md and
# the hackathon-readiness milestone burndown actually work. This script is the
# single source of truth for the label set.
#
# Idempotent: uses `gh label create --force`, which updates color/description
# if the label already exists. Safe to re-run after edits.
#
# Usage:
#   ./scripts/setup-dogfood-labels.sh                       # default repo (below)
#   ./scripts/setup-dogfood-labels.sh owner/repo            # override
#   REPO=owner/repo ./scripts/setup-dogfood-labels.sh       # env-var override
#
# Requires:
#   - `gh` CLI installed and authenticated (`gh auth status`)
#   - repo scope on the token (default `gh auth login` gives this)

set -euo pipefail

DEFAULT_REPO="jerelvelarde/london-a2ui-a2a-starter"
REPO="${1:-${REPO:-$DEFAULT_REPO}}"

RED='\033[31m'
GREEN='\033[32m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

if ! command -v gh >/dev/null 2>&1; then
  echo -e "${RED}FAIL:${RESET} \`gh\` CLI not found. Install: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo -e "${RED}FAIL:${RESET} \`gh\` is not authenticated. Run \`gh auth login\` first." >&2
  exit 1
fi

echo -e "${BOLD}Creating dogfood-friction labels on${RESET} ${REPO}\n"

# Label manifest:  name|color|description
# Colors:
#   d73a4a — red    (entry point + P0)
#   eb6420 — orange (P1)
#   fbca04 — yellow (P2)
#   0e8a16 — green  (area:*)
#   1d76db — blue   (target-persona:*)
LABELS=(
  "dogfood-friction|d73a4a|Entry point. Required on every friction issue filed via the dogfood-friction template."
  "severity:P0-blocker|d73a4a|Documented path fails outright; hackathon attendee cannot continue. Must close by Jun 10."
  "severity:P1-pain|eb6420|Documented path works only with a workaround / extra step. Must close by Jun 10."
  "severity:P2-polish|fbca04|Documented path works but cost time or confidence. Backlog after Jun 10."
  "area:agent-py|0e8a16|Python agent (\`agent/\`)."
  "area:catalog-ts|0e8a16|TS catalog / renderer wiring (\`src/app/api/copilotkit/\`, schema arrays)."
  "area:scripts|0e8a16|pnpm scripts (\`scripts/\`, \`package.json\`)."
  "area:docs|0e8a16|AGENTS.md, HACKATHON.md, in-tree READMEs."
  "area:ax-rules|0e8a16|AI-assistant guidance (slash command vocab, anti-patterns, skills)."
  "target-persona:claude-code|1d76db|Friction hit by Claude Code users."
  "target-persona:gemini-cli|1d76db|Friction hit by Gemini CLI users."
  "target-persona:cursor|1d76db|Friction hit by Cursor / Windsurf / Codex CLI / Aider users."
  "target-persona:human-only|1d76db|Friction hit by a human reading the docs without an AI assistant."
)

fail_count=0

for entry in "${LABELS[@]}"; do
  name="${entry%%|*}"
  rest="${entry#*|}"
  color="${rest%%|*}"
  desc="${rest#*|}"

  if gh label create "$name" \
       --color "$color" \
       --description "$desc" \
       --repo "$REPO" \
       --force >/dev/null 2>&1; then
    echo -e "${GREEN}OK:${RESET} $name ${DIM}(#${color})${RESET}"
  else
    echo -e "${RED}FAIL:${RESET} $name ${DIM}(see \`gh label create --help\`)${RESET}"
    fail_count=$((fail_count + 1))
  fi
done

echo

if [[ "$fail_count" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All ${#LABELS[@]} labels created/updated on ${REPO}.${RESET}"
  echo -e "${DIM}Verify: gh label list --repo ${REPO} | grep dogfood-friction${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}${fail_count} label(s) failed.${RESET} Check \`gh auth status\` and repo write access."
  exit 1
fi
