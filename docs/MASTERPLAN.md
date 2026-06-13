# Masterplan — Generative Learning Environments

**Product:** a university student drops in a course (PDF) *or* asks a question,
and an AI agent generates a learning environment tailored to the content —
quizzes, charts, parametric simulations, and interactive 3D — composed live
from a component catalog, with a free-form escape hatch for anything bespoke.

**Track:** Generative UI (AG-UI + A2UI). Judged on originality, economic value,
technical difficulty, and use of generative UI.

---

## The one-paragraph thesis

**The engine already exists on `copilearn`.** The `/dynamic` page is a single
input (upload a PDF *or* type a question) → a LangGraph agent
(`query_pdf` + `web_research` + `generate_a2ui`) → a live A2UI surface rendered
by CopilotKit. `generate_a2ui` is a second LLM that *invents the component tree
from the catalog* — that is already "the agent picks the right components." The
catalog already has quizzes, flashcards, charts, a parametric simulation
(`RateShockSimulator`), and `FreeformUI` (sandboxed-iframe free-form 2D/SVG/
canvas). **So this masterplan is "generalize the engine + add real 3D," not
"build a platform."**

```
 ┌───────────────────────────── EXISTING (works today) ──────────────────────────┐
 │  single input (CopilotChat: 📎 upload PDF  OR  type a question)                 │
 │         │                                                                       │
 │         ▼                                                                        │
 │  dynamic_agent ── query_pdf ── web_research(Linkup) ── generate_a2ui            │
 │                                                            │                     │
 │                          generate_a2ui = 2nd LLM that DECIDES + COMPOSES the    │
 │                          component tree  ← this IS the "UI orchestrator"        │
 │                                                            ▼                     │
 │  SurfaceCanvas ◀── CopilotKit a2ui-renderer paints catalog + FreeformUI         │
 └─────────────────────────────────────────────────────────────────────────────┘
            ▲                                   ▲
   GENERALIZE (subject-agnostic prompt)   ADD (one real 3D catalog component)
```

## Two decisions already locked

1. **One agent, not two.** `generate_a2ui` both *decides* which components fit
   and *composes* them; the a2ui-renderer *interprets*. There is no separate
   "frontend UI-orchestrator agent" — CopilotKit already abstracts that.
   Building a second agent is explicitly **out of scope**.
2. **Lean stack.** The repo already covers the proposed UI stack's jobs:
   `recharts` (charts), the A2UI catalog (widgets), `FreeformUI` (free-form),
   CopilotKit (chat/stream/state). **The only new dependency we add is React
   Three Fiber** (for real 3D). Everything else from the pasted stack
   (Zustand, TanStack, Tremor, Theatre, Spline, Pixi, Vercel AI SDK) is **out
   of scope** unless a concrete demo blocks on it.

## Scope (locked = build; out = don't)

| In scope | Out of scope |
|---|---|
| Subject-agnostic agent prompt (component choice by content type) | A second/frontend orchestrator agent |
| One real interactive 3D catalog component (`Scene3D`, R3F) | The full pasted UI stack (R3F is the only add) |
| Single-input landing (point `/` at the dynamic experience) | Reworking the `/fixed` dashboard (leave as-is) |
| `DESIGN.md` "Pixel Campus" styling on all surfaces | New auth, persistence, accounts, multi-user |
| Web research → cited "go deeper" (already built) | Spline hero scenes / Theatre sequencing |

---

## Lane split (from the team agreement)

- **Max — agent lane** (`agent/`, not `catalog.py`): the subject-agnostic
  prompt, the component-choice decision logic, `web_research` (done), the
  `Scene3D` spec the agent emits.
- **Ale — UI lane** (all `src/`, plus `agent/src/catalog.py` the mirror): the
  `Scene3D` R3F renderer + Zod schema, the single-input landing, `DESIGN.md`
  theming, polish.

The coupling is the **`Scene3D` contract** below — agree it first. Note one
genuinely two-way seam: the per-domain steering touches the `generate_a2ui`
prompt (Max) *and* `CATALOG_PROMPT` (Ale's `catalog.py`). Resolve it by giving
Max the one-line `Scene3D` entry in `CATALOG_PROMPT` (it's prompt steering),
leaving only the Zod schema + renderer with Ale — or pair for 10 minutes on
the prompt. Otherwise the lanes are near-disjoint (append-only edits).

---

## Workstream 1 — Generalize the agent (Max)

Today the agent is tuned for "lecture material" and is IRR/finance-flavored.
Make it **domain-aware**: detect the content's subject and pick components
accordingly. Prompt + extractor work, no new architecture. **Two files, and
the *where* matters:**

- **`agent/src/pdf_tools.py` (`query_pdf`)** — the extractor prompt is
  finance-flavored and emits `shape_hint`. Generalize it so spatial/structural
  content yields data a `Scene3D` can bind (e.g. add a `scene`/`structure`
  shape_hint + a domain field). Without this, the agent never gets spatial
  structured data and 3D never fires.
- **`agent/src/dynamic_agent.py` — the `generate_a2ui` prompt, NOT only the
  primary `SYSTEM_PROMPT`.** Component *composition* is done by the secondary
  LLM inside `generate_a2ui` (it builds its own prompt + `CATALOG_PROMPT`); the
  primary agent just calls `generate_a2ui()` with no args. So the per-domain
  steering below must land in the `generate_a2ui` prompt (Max's file) and/or
  `CATALOG_PROMPT` (Ale's file — coordinate). Steering placed only in
  `SYSTEM_PROMPT` will not reach the composer.

**Component-choice rules to encode (in the `generate_a2ui` prompt):**

| Detected content | Lead components |
|---|---|
| Math / quantitative | parametric simulation (`RateShockSimulator`-style) + `LineChart`/`ScatterChart` |
| Physics / chemistry | `Scene3D` (vectors, molecules, fields) + charts |
| Life sciences | `Scene3D` (structures) or labeled `FreeformUI` SVG diagram + charts |
| Humanities / law / history | `Flashcard` deck, `QuizGame`, a `FreeformUI` timeline, rich `Callout`/`Text` |
| Any subject | `QuizGame` + `Flashcard` are the universal study layer |
| "latest / real-world / current" | `web_research` → cited briefing (already built) |

Keep the existing hard rules (one `generate_a2ui` per turn, empty chat reply,
study-flow vs go-deeper-flow). Generalize the *vocabulary*, not the *control
flow*. Add **2-3 worked few-shot examples in the `generate_a2ui` prompt** (one
per domain, including the `Scene3D` example below) so the temperature-0
secondary LLM reliably maps subject → components. Few-shots in `SYSTEM_PROMPT`
do not steer the composer — they must be in the `generate_a2ui` prompt.

**Also loosen the no-doc guard:** today a bare typed question with no PDF
replies "Attach a PDF." Change it so a no-doc question that isn't clearly a
study request routes to `web_research` → cited surface. This makes the
"ask anything, no upload" entry actually work (see demo step 1).

## Workstream 2 — The 3D component (Ale builds renderer; Max feeds the spec)

`FreeformUI`'s sandbox blocks external URLs, so 3D can't run inside it. We add
**one** real catalog component. Build it like any catalog component (Seam #4):
Zod def in `definitions.ts`, renderer in `renderers.tsx`, one-line mirror in
`catalog.py`'s `CATALOG_PROMPT`.

**`Scene3D` contract (agree this verbatim before building):**

```ts
Scene3D {
  title?: string
  height?: number            // default 360
  autoRotate?: boolean
  objects: Array<{
    shape: "sphere" | "box" | "cylinder" | "cone" | "torus" | "plane"
    position?: [number, number, number]   // default [0,0,0]
    scale?: number | [number, number, number]   // default 1
    color?: string           // hex; default from DESIGN.md palette
    label?: string           // floating text (drei <Html>/<Text>)
  }>
}
```

- Renderer: `@react-three/fiber` `<Canvas>` + `@react-three/drei`
  `OrbitControls` + primitive meshes + `<Html>`/`<Text>` labels. **Boundary
  placement matters:** the `Scene3D` catalog renderer stays a normal *sync*
  export (the catalog registry imports it synchronously); wrap **only the
  `<Canvas>` subtree** in a `next/dynamic(..., { ssr:false })` child so R3F
  never enters SSR and the registry import doesn't break.
- **Install + pin first:** `pnpm add @react-three/fiber @react-three/drei
  three`, confirm React-19 peer compat (drei `<Html>`/`<Text>` pull
  `troika-three-text` — watch peer warnings on Next 16/Turbopack), add them to
  the `FROZEN.md` allowlist, and re-run `pnpm verify-pins`. This is a new dep
  outside the frozen set, so it needs the explicit FROZEN.md note.
- **Graceful fallback:** if `objects` is missing/empty/invalid, render a
  `Callout` ("3D scene unavailable") instead of throwing — never blank the
  canvas. Validate with the Zod schema; bad props degrade, not crash.
- Style per `DESIGN.md` (Pixel Campus): flat shading, chunky outlines, the
  palette's `--accent`/`--ink` for materials and labels.
- Max's steering (in the `generate_a2ui` prompt): "for spatial/structural
  content (molecules, geometry, vectors, anatomy), emit a `Scene3D` with
  labeled primitives," plus the worked few-shot (e.g. a water molecule: 1 red
  sphere + 2 white spheres + a label). This is the per-domain few-shot from
  Workstream 1 — it lives with the other composer examples, not in
  `SYSTEM_PROMPT`.

> Parametric *simulations* stay the self-contained-widget pattern
> (`RateShockSimulator`). Do **not** try to make `Scene3D` parametric in the
> time box — keep 3D = orbitable labeled modelization, sims = widgets. If time
> remains, a `FunctionPlotter` (plot y=f(x) with slider params, 2D canvas) is
> the highest-value stretch — but it's a stretch, not core.

## Workstream 3 — Single-input landing + theming (Ale)

- Point `/` at the dynamic experience. Concrete approach (pick one, don't
  both): either `redirect('/dynamic')` from `app/(pdf)/page.tsx`, or have `/`
  re-export `DynamicPage`. Don't rebuild the chat+canvas wiring.
- Theme per `DESIGN.md` (it exists at the repo root — the "Pixel Campus"
  system; tokens like `--ink`, `--accent`). Map its tokens onto the real
  variables in `src/a2ui/theme.css` + `src/app/(pdf)/pdf-analyst.css` (the
  theming seam). **Scope the pass to the shell + the 3-4 components the demo
  shows** (chat, canvas, Scene3D, QuizGame); defer theming the other ~17
  catalog components — that full pass is not a 1-hour job.
- De-emphasize `/fixed` and `/catalog` in nav for the demo (keep them, hide).

---

## Demo script (what wins the room)

1. **Open with the input.** Type a clearly-web question with no upload, e.g.
   *"What's the latest real-world research on X?"* → agent does `web_research`
   → cited briefing surface. (Requires the no-doc-guard loosening in
   Workstream 1; until that lands, a bare question replies "Attach a PDF," so
   use explicit "latest/real-world" phrasing and test it before the demo.)
2. **Upload a chemistry/physics PDF** → agent emits a **`Scene3D`** molecule/
   vector scene you can orbit + a quiz. "It chose 3D because the content is
   spatial."
3. **Upload a quant/finance PDF** → agent emits a **parametric simulation** +
   charts. "Same input, totally different environment — the agent decided."
4. **Ask a follow-up** → a fresh tailored surface. "Generative UI, not a
   template." If you have a spare beat, show a `FreeformUI` bespoke visual.

The throughline for judges: **one input, the agent reads the content and
generates the right interactive environment — widgets when they fit, real 3D
when it helps, free-form when nothing else does.**

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Gemini emits invalid `Scene3D` JSON | Tight Zod schema + few-shot example + renderer fallback to `Callout` |
| R3F SSR / bundle issues in Next | `next/dynamic` `ssr:false`, client-only; R3F is the only new dep |
| Agent over/under-uses 3D | Explicit per-domain rules + examples in the prompt; bias to widgets, 3D only for spatial content |
| Time runs out on 3D | Build Workstream 1 first (ships full value alone); 3D is additive and isolated |
| Demo Wi-Fi flaky | `web_research` degrades gracefully; uploaded-PDF flow needs only Gemini |

## Sequence (time-boxed, ~5h window)

```
 0:00  Agree Scene3D contract + Ale spikes a bare <Canvas><mesh> orbiting in
       this Next 16 build (the R3F-in-Next risk) + install/pin R3F + FROZEN.md
       note + verify-pins.  Max: install nothing, start prompt work.   (both)
 0:30  Max: generalize generate_a2ui prompt + pdf_tools.py extractor   │ Ale: Scene3D renderer + Zod
 1:30  Max: Scene3D few-shot + test 3 demo PDFs e2e (gates 3D value)   │ Ale: single-input landing
 2:30  Integrate: CATALOG_PROMPT Scene3D line + pnpm smoke             (both)
 3:00  Theme shell + demo components only (Ale)                        │ Max: no-doc-guard + prompt hardening
 4:00  Demo dry-run on the 3 baked PDFs, fix surprises                 (both)
 4:30  Polish + buffer
```

Move the 3-PDF e2e test to 1:30 (not 4:00): it gates the entire 3D value prop,
so find out early if the agent reliably emits good `Scene3D` scenes.

Run `pnpm smoke` before declaring any slice done. Branch per task off
`copilearn`, small PRs, merge fast.

## Out of scope — written down so it's not in our heads

- Second/frontend orchestrator agent (generate_a2ui already does it).
- Zustand, TanStack Query, Tremor, Theatre.js, Spline, Pixi, Vercel AI SDK,
  cmdk, Sonner — none needed for the demo; revisit only if a concrete surface
  blocks on one. (R3F is the sole new dependency.)
- Auth, persistence, accounts, the `/fixed` dashboard rework.
