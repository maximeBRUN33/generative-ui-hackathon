# Linkup "Go Deeper" — backend handoff for Alessandro (UI)

**TL;DR for the UI lane: you don't have to do anything for this to work.**
The agent now reaches the live web, and the results flow through the existing
`generate_a2ui` pipeline you already render. It renders today with the current
catalog (and `FreeformUI`). Everything below is *optional polish*, not a
blocker.

— Max (agent lane)

---

## What I added (agent side only)

| File | Change |
|---|---|
| `agent/src/linkup_tools.py` | **new** — `web_research(query)` tool (Linkup `sourcedAnswer`, `depth="standard"`) |
| `agent/src/dynamic_agent.py` | wired `web_research` into the tool list + added a "go-deeper / web flow" to the system prompt |
| `agent/pyproject.toml` | added `linkup-sdk>=0.18.2` |
| `.env` | `LINKUP_API_KEY` set (gitignored, shared test key) |

I did **not** touch `agent/src/catalog.py`, `src/`, `definitions.ts`, or
`renderers.tsx` — your lane stays clean. The split holds.

## How a turn flows now

```
learner asks a "what's the latest / real-world / current" question
        │
        ▼
  web_research(query)        ← Linkup live search, 1–2 calls
        │   returns JSON {query, answer, sources:[…]}  (lands in message history)
        ▼
  generate_a2ui()            ← secondary LLM SEES that JSON for free and
        │                       designs the surface from it
        ▼
  A2UI surface  ──────────▶  YOUR renderer paints it (CopilotKit a2ui-renderer)
```

Plain study questions ("explain X", "make flashcards") are unchanged:
`query_pdf → generate_a2ui`. `web_research` only fires on go-deeper questions.
(Both paths verified end-to-end against Gemini.)

## The contract (the entire interface between us)

`web_research` returns a JSON **string** with this stable, flat shape:

```jsonc
{
  "query":   "current Bank of England base rate",
  "answer":  "The Bank of England base rate in January 2026 is 3.75%. …",  // synthesized, citeable
  "sources": [
    {
      "title":   "Effective interest rates — January 2026",
      "url":     "https://www.bankofengland.co.uk/statistics/…",
      "snippet": "This statistical release contains average interest rates…",
      "favicon": "https://favicons.linkup.so?domain=www.bankofengland.co.uk"
    }
    // … up to ~20
  ]
}
// on failure: { "query": "...", "error": "…", "sources": [] }
```

That's it. `{ title, url, snippet, favicon }` per source. If you build a
React component, code against this shape and you're done.

## What the agent does with it today (zero UI work)

The prompt already instructs `generate_a2ui` to render go-deeper results with
**full creative freedom**:

- lead with `answer` (Heading + Text, or a Callout takeaway),
- render `sources` as clickable citations (BulletList / Cards),
- or author a bespoke **`FreeformUI`** "research briefing" surface when it
  wants something richer than the catalog.

So **open generative UI is live out of the box** — the agent will sometimes
hand you a hand-authored HTML surface in the sandboxed `FreeformUI` iframe.
No new renderer needed.

## Optional polish (only if you want it)

### A dedicated `Citation` / `SourceList` component
Nicer than a generic BulletList, and it's where the `favicon` shines. Suggested
props (your call on the exact shape):

```ts
SourceList { sources: [{ title: string; url: string; snippet?: string; favicon?: string }] }
```

If you add it: definition + Zod schema in `definitions.ts`, renderer in
`renderers.tsx`, **and one line in `agent/src/catalog.py`'s `CATALOG_PROMPT`**
so the agent knows to emit it (that file is yours — append at the end, the
agent will pick it up). Ping me and I'll point the prompt at it.

### ⚠️ favicon gotcha — FreeformUI vs React
- A **React** component (`SourceList` above) renders in the normal DOM and
  **can** load the `favicon` URL as an `<img>`. 👍
- **`FreeformUI`** runs in a sandboxed iframe that **blocks all external URLs**
  (CSP). So favicons (and any external image) will **not** load inside a
  FreeformUI surface — the agent is told to show title + url text there
  instead. If you see a missing-image in a generated surface, that's why,
  and it's expected.

## How to demo / test
1. `pnpm dev` (boots Next + the FastAPI agent on :8123).
2. Go to `/dynamic`, attach any lecture PDF (or none).
3. Ask a live-web question, e.g.:
   - *"What's the real-world Bank of England base rate right now, and how does it hit bond prices today?"*
   - *"What are the latest developments on this topic in 2026?"*
4. You should see a generated surface citing live sources. (The agent picks
   the go-deeper flow on its own from the wording.)

Backend is committed and smoke-passing (`pnpm smoke`). Shout if the shape
above doesn't give you what you need to render.
