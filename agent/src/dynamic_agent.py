"""Dynamic-schema Q&A agent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMIZATION SEAM #5 — Swap the agent flow (dynamic-schema Q&A)
See HACKATHON.md §5 for the full recipe. Edit the prompts below to change
how the secondary LLM composes answer UI from the catalog. The fixed
dashboard flow lives in fixed_agent.py.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The agent answers any question about the most-recently-uploaded PDF by
inventing the UI for the answer using our custom catalog.

## Why this looks the way it does

The first cut wired things up to use the JS-runtime-injected `render_a2ui`
frontend tool. That works on turn 1 but leaves an orphan
`function_call` in agent state (CopilotKitMiddleware strips frontend
tool calls in `after_model` and restores them in `after_agent`. between
those two phases ToolNode never sees the call, so no `ToolMessage` is
ever produced). The result is turn 2 hitting OpenAI's Responses API
with an unanswered function_call → INCOMPLETE_STREAM / "terminated".

The CopilotKit reference example in
`CopilotKit/examples/integrations/langgraph-python` solves this by
NOT injecting `render_a2ui` as a frontend tool at all. Instead, the
agent has a real Python tool (`generate_a2ui` here) that:

  1. Runs server-side as a normal LangChain tool.
  2. Spawns a secondary LLM bound to a no-op `render_a2ui` tool to
     force structured output.
  3. Wraps the LLM's tool_call args into A2UI `create_surface` +
     `update_components` + `update_data_model` operations.
  4. Returns the rendered ops as a JSON string. a normal tool result.

The JS-side a2ui middleware detects `a2ui_operations` in the
TOOL_CALL_RESULT and emits the ACTIVITY_SNAPSHOT events the canvas
listens for. No frontend tool stripping. No orphan. No turn-2 crash.

`web/src/app/api/copilotkit/route.ts` sets `injectA2UITool: false` to
match.
"""
from __future__ import annotations

import json
import os
from typing import Any

from copilotkit import CopilotKitMiddleware, a2ui
from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import SystemMessage
from langchain_core.tools import tool as lc_tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver

from src.catalog import CATALOG_ID, CATALOG_PROMPT
from src.linkup_tools import web_research


# ── Gemini prop-stripping fix ─────────────────────────────────────────────
# The first cut typed `render_a2ui.components` as `list[A2uiComponent]` with
# `ConfigDict(extra="allow")`, hoping Gemini would pass arbitrary catalog
# props (text, children, data, columns, …) through the open model. It does
# NOT: `langchain-google-genai`'s tool-call args parser strips every key the
# declared schema doesn't name, so the server only ever saw bare
# `{id, component}` nodes — no children, no data, no text. The root Stack
# then had no children and the canvas rendered blank.
#
# Fix: declare the surface as SCALAR STRING params the schema can't strip —
# `components_json` (a JSON array string) and `data_json` (a JSON object
# string) — and parse them server-side. A scalar string param is proven to
# survive forced `tool_choice` on gemini-3.5-flash (Phase-0 spike), so the
# full component tree (with every prop) round-trips intact.
@lc_tool
def render_a2ui(
    surfaceId: str,
    catalogId: str,
    components_json: str,
    data_json: str = "{}",
) -> str:
    """Render a dynamic A2UI v0.9 surface.

    Args:
        surfaceId: Unique surface identifier (kebab-case).
        catalogId: The catalog ID. Use the one provided in context.
        components_json: The FULL A2UI v0.9 flat component array, serialized
            as a JSON array string. Each node is an object with its real
            catalog props inline (id, component, plus text/children/data/
            columns/value/etc. for that component type). Exactly one node
            MUST have id="root". Example:
            '[{"id":"root","component":"Stack","children":["c1"]},
              {"id":"c1","component":"StatCard","label":"Revenue",
               "value":"$94,930M","delta":"+6.1%"}]'
        data_json: Optional initial data model, serialized as a JSON object
            string. Use "{}" (the default) when all data is inlined into the
            components.
    """
    return "rendered"


# Secondary LLM — forced to call render_a2ui so its output is a structured
# tool_call. Gemini 3.5 Flash via the native Google Gen AI SDK. Forced
# tool_choice across multi-turn replay is proven viable on this SDK
# (no thought_signature 400) — see FROZEN.md "LLM provider".
#
# Constructed lazily (not at import time): ChatGoogleGenerativeAI validates
# the API key in its constructor and raises with no key. Building it on first
# use lets `import main` succeed with OFFLINE=1 and no key. /dynamic still
# requires a key — the client is built the first time the dynamic agent
# actually runs (generate_a2ui or the agent's model node), so online behavior
# is unchanged.
_RENDER_MODEL: ChatGoogleGenerativeAI | None = None


def _render_model() -> ChatGoogleGenerativeAI:
    global _RENDER_MODEL
    if _RENDER_MODEL is None:
        _RENDER_MODEL = ChatGoogleGenerativeAI(
            model=os.getenv("MODEL", "gemini-3.5-flash"),
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0,
            # No max_output_tokens: a fixed cap truncated the forced render_a2ui
            # tool call mid-output (-> empty tool_calls -> "Couldn't build the
            # level"). Letting the model use its full default output budget
            # avoids those truncation failures. We keep generations short by
            # asking for LESS (compact workspace + one small sim) in the prompt,
            # not by capping tokens. The logs still print finish_reason so a
            # genuine MAX_TOKENS (model-default) case stays visible.
        )
    return _RENDER_MODEL


class _LazyRenderModel:
    """Defers ChatGoogleGenerativeAI construction until the dynamic agent's
    model node first touches it (profile / bind_tools / bind / invoke).

    create_agent stores the model at build time but only calls into it at
    invoke time, so wrapping it here means `import main` (and thus building
    the graph) never constructs a Gemini client — yet every /dynamic request
    uses the real model exactly as before. Online behavior is unchanged.
    """

    @property
    def profile(self) -> Any:
        return _render_model().profile

    def bind_tools(self, *args: Any, **kwargs: Any) -> Any:
        return _render_model().bind_tools(*args, **kwargs)

    def bind(self, *args: Any, **kwargs: Any) -> Any:
        return _render_model().bind(*args, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(_render_model(), name)


# ── Layout order + colorfulness directive ─────────────────────────────────
# Shapes how the composer arranges and colors the surface. Plain string
# (appended to the composer prompt, before the simulation directive).
LAYOUT_COLOR_DIRECTIVE = """

## Layout order & color (Pixel Campus arcade — NOT a slide deck)

ORDER the surface like a game level:
- Open with a Heading + a short punchy Callout (the hook / "what you'll learn").
- Then the interactive tools: flashcards, the QuizGame, and the sim.
- Put the ConceptMap (the learning path / how-it-connects graph) LAST, at the
  very BOTTOM of the surface — it is the end-of-level recap, NEVER the intro.

BE COLORFUL — avoid an all-cream surface:
- Tag concepts with vivid **Badge**s (positive=green, info=gold, warning=coral,
  danger=red) used like arcade stickers ("CORE", "LVL 1", "EXAM", "KEY").
- Alternate **Card** tones (lilac=gold, mint=green, warning=coral) across
  sections so adjacent cards differ in color.
- Use **Callout** tones (positive / info / warning) for takeaways, not plain
  text; give every **Section** a short ALL-CAPS eyebrow.
- When the lecture has numbers, lead with a colorful StatCard row.
"""


# ── Pixel Campus simulation directive ─────────────────────────────────────
# Every generated learning surface must include ONE interactive simulation,
# specific to the uploaded lecture, authored as a self-contained FreeformUI
# node in the Pixel Campus 16-bit style (docs/pixel-campus-ui-kit.html). This
# is a PLAIN string (not an f-string) so the template's { } and quotes are
# literal. It is appended to the generate_a2ui composer prompt below.
PIXEL_SIM_DIRECTIVE = """

## MANDATORY — a lecture-specific interactive simulation (EVERY surface)

Every surface you build MUST contain exactly ONE `FreeformUI` simulation node:
an interactive *simulation* of a concept FROM THIS LECTURE — a playable model
with sliders the learner drags to see cause and effect. It must be specific to
the lecture's real subject, never a generic placeholder. Pick a model that fits:
- physics -> projectile / pendulum / inclined plane / wave / orbit
- chemistry -> titration curve / reaction equilibrium / gas laws
- biology -> population growth / predator-prey / enzyme kinetics
- economics or finance -> supply & demand / bond price vs yield / compounding
- math -> plot y=f(x) with the lecture's parameters as sliders
- CS -> sorting steps / Big-O growth curves / a small state machine
If nothing fits, model the lecture's core cause-effect relationship anyway
(e.g. a timeline scrubber or a single-variable what-if).

Author it as a SELF-CONTAINED FreeformUI node. Rules:
- Node shape: {"id":"sim","component":"FreeformUI","title":"<lab name>",
  "height":520,"html":"<self-contained HTML doc>"}. Give it room (height 520,
  canvas ~260 tall).
- The html is ONE document: inline <style> + markup + inline <script>. NO
  external URLs, fonts, images, or network calls (the sandbox blocks them).
- Pixel Campus look: define this palette as CSS vars at the top and use it —
  --primary:#F4E4C1; --ink:#1B2A4A; --outline:#0E1626; --tertiary:#F0596A;
  --accent:#FFC94D; --success:#5FBF6A; --sky:#1C5FB0; --ground:#7E8A99 .
  font-family: ui-monospace, monospace; html{image-rendering:pixelated};
  square corners; 3-4px solid var(--outline) borders; hard offset shadows
  (box-shadow:5px 5px 0 var(--outline)); accent-color:var(--accent) on ranges.
- Structure: a <canvas> stage (dark bg) that DRAWS the model, 2-3
  <input type=range> sliders bound to the lecture's real variables (label each
  with its name + a LIVE value), and a one-line readout. Sliders redraw the
  canvas AND update the readout LIVE on 'input' — that IS the interaction.
- BUTTONS — important: do NOT add a "RUN" button to a continuously-updating
  sim. If dragging the sliders already shows the effect, a RUN button does
  nothing and confuses the user — leave it out. Add an action button (▶ FIRE /
  ▶ RUN TRIAL / ▶ STEP / ▶ DROP) ONLY when the model has a DISCRETE event with
  a clear before->after. When you do, the outcome MUST be unmistakable: animate
  the change (requestAnimationFrame) AND flip a COLORED result banner — e.g.
  set a div's background green with "✓ HIT / CORRECT" or red with "✗ MISS" so
  the user plainly sees what happened. Never ship a button whose click produces
  no visible change.
- Keep the JS small and dependency-free (a draw() that reads slider values and
  paints rects/arcs). Place the simulation prominently, after a short heading.
- Guard against NaN so a value never blanks the canvas.

KEEP THE SIM TINY — the html MUST be UNDER ~28 lines / ~1.3KB. It is generated
one character at a time, so a long sim is the main thing that makes the wait
long. One canvas, 2 sliders, one LIVE readout (add an action button ONLY if it
triggers a discrete outcome — see the BUTTONS rule). Minimal CSS, no comments.

Skeleton to ADAPT for EACH sim (swap the variables, labels, and the draw()/RUN
math to THIS lecture — keep it this small, give the canvas room):

<!doctype html><meta charset=utf-8><style>
body{font-family:ui-monospace,monospace;background:#F4E4C1;color:#1B2A4A;margin:0;padding:8px}
canvas{display:block;width:100%;height:260px;background:#0E1626;image-rendering:pixelated;border:4px solid #0E1626}
.r{display:grid;grid-template-columns:90px 1fr 48px;gap:8px;align-items:center;padding:6px 0}
b{font-size:12px;text-transform:uppercase}.v{text-align:right;color:#F0596A;font-weight:700}
input{width:100%;accent-color:#FFC94D}
button{font-family:inherit;border:4px solid #0E1626;box-shadow:4px 4px 0 #0E1626;background:#F0596A;color:#fff;padding:8px 12px;margin-top:6px;cursor:pointer}
</style>
<canvas id=c width=600 height=260></canvas>
<div class=r><b>Speed</b><input id=s1 type=range min=10 max=90 value=45><span class=v id=v1>45</span></div>
<div class=r><b>Gravity</b><input id=s2 type=range min=2 max=20 value=10><span class=v id=v2>10</span></div>
<div id=out>Range: 0</div>
<script>
var x=c.getContext('2d');function d(){x.fillStyle='#0E1626';x.fillRect(0,0,600,260);
var a=(+s1.value||0)*Math.PI/180,g=(+s2.value||1),vx=Math.cos(a)*8,vy=Math.sin(a)*8,t,X,Y,last=10;
x.fillStyle='#FFC94D';for(t=0;t<70;t+=0.5){X=10+vx*t;Y=250-(vy*t-0.5*g*0.1*t*t);if(Y>250)break;x.fillRect(X,Y,4,4);last=X}
v1.textContent=s1.value;v2.textContent=s2.value;out.textContent='Range: '+Math.round(last-10)}
s1.oninput=d;s2.oninput=d;d();
</script>

This skeleton is LIVE (no button): dragging a slider redraws the arc and
updates "Range" instantly. Only if the sim needs a discrete action instead,
add `<button id=run>▶ FIRE</button>` + `<div id=verdict></div>`, and on click
animate (requestAnimationFrame) then set verdict.style.background to '#5FBF6A'
with "✓ HIT" or '#F0596A' with "✗ MISS" — the result MUST visibly change.

Keep the other study tools too (flashcards, quiz) — the sim is ADDITIONAL.
Output STRICT JSON: the html is the value of the FreeformUI node's "html" key,
inner double-quotes escaped so components_json stays valid JSON.
"""


# ── Mini-game directive (StudyBuddy "Yes") ────────────────────────────────
# Highest-priority MODE OVERRIDE: when the learner asks to play a mini-game,
# the composer drops the study workspace and builds a single self-contained
# 5-level pixel game about the lecture. Plain string (braces/quotes literal).
PIXEL_MINIGAME_DIRECTIVE = """

## MODE OVERRIDE — MINI-GAME (highest priority, overrides everything above)

IF the most recent user message asks to PLAY a mini-game (mentions "mini-game",
"play", or "5-level"), IGNORE all rules above — NO flashcards, NO quiz, NO two
sims, NO concept map. Build ONLY a game:

Emit a root Stack with ONE FreeformUI node whose html is a self-contained
5-LEVEL pixel game ABOUT THIS LECTURE:
- 5 levels, each HARDER than the last; each TEACHES something NEW about the
  subject (a one-sentence fact/insight) BEFORE its challenge, so the game is
  genuinely useful — not just trivia.
- Very gamified, Pixel Campus style: 3 lives (hearts), a SCORE, a "LEVEL x/5"
  meter. Right answer -> points + advance + green "NICE!"; wrong -> lose a life
  + red mark + reveal the correct answer. 0 lives -> GAME OVER (retry). Clear
  level 5 -> victory screen ("MASTERED! +XP").
- DATA-DRIVEN and COMPACT (keep the whole html under ~2.5KB so it generates
  fast): one LEVELS array of 5 objects (3 options each, a ONE-line teach) + a
  small engine that renders the current level. Do NOT hand-code 5 separate
  screens.
- Self-contained: inline <style> + <script>, NO external URLs/fonts/images.
  Palette --primary:#F4E4C1; --ink:#1B2A4A; --outline:#0E1626;
  --tertiary:#F0596A; --accent:#FFC94D; --success:#5FBF6A. font ui-monospace;
  html{image-rendering:pixelated}; square corners; 4px var(--outline) borders;
  hard offset shadows.

Compact engine to ADAPT (swap LEVELS content to the lecture; keep it this small):

<!doctype html><meta charset=utf-8><style>
body{font-family:ui-monospace,monospace;background:#1C5FB0;color:#1B2A4A;margin:0;padding:12px}
.hud{display:flex;justify-content:space-between;color:#F4E4C1;font-weight:700;margin-bottom:8px}
.card{background:#F4E4C1;border:4px solid #0E1626;box-shadow:6px 6px 0 #0E1626;padding:14px}
.teach{background:#FFC94D;border:3px solid #0E1626;padding:8px;margin-bottom:10px}
button{display:block;width:100%;text-align:left;font-family:inherit;border:4px solid #0E1626;box-shadow:4px 4px 0 #0E1626;background:#fff;margin:6px 0;padding:10px;cursor:pointer}
#msg{font-weight:700;margin-top:8px}
</style>
<div class=hud><span id=lvl>LEVEL 1/5</span><span id=lives>HP 3</span><span id=score>0 XP</span></div>
<div class=card><div class=teach id=teach></div><div id=q></div><div id=opts></div><div id=msg></div></div>
<script>
var L=[
 {teach:"NEW FACT 1",q:"Q1?",o:["A","B","C"],c:0},
 {teach:"NEW FACT 2",q:"Q2?",o:["A","B","C"],c:1},
 {teach:"NEW FACT 3",q:"Q3?",o:["A","B","C"],c:2},
 {teach:"NEW FACT 4",q:"Q4?",o:["A","B","C"],c:0},
 {teach:"BOSS FACT 5",q:"Q5?",o:["A","B","C"],c:1}
];
var i=0,hp=3,score=0;
function render(){var l=L[i];lvl.textContent='LEVEL '+(i+1)+'/5';lives.textContent='HP '+hp;score.textContent=score+' XP';
 teach.textContent='NEW: '+l.teach;q.textContent=l.q;msg.textContent='';opts.innerHTML='';
 l.o.forEach(function(t,k){var b=document.createElement('button');b.textContent=t;b.onclick=function(){pick(k)};opts.appendChild(b);});}
function pick(k){var l=L[i];if(k===l.c){score+=20*(i+1);msg.style.color='#1a7a32';msg.textContent='NICE! +'+(20*(i+1));i++;if(i>=L.length){win();return;}setTimeout(render,700);}
 else{hp--;msg.style.color='#c0303c';msg.textContent='Correct: '+l.o[l.c];if(hp<=0){over();return;}setTimeout(render,900);}}
function win(){document.querySelector('.card').innerHTML='<h2>MASTERED!</h2><p>Score '+score+' XP — all 5 levels cleared.</p>';}
function over(){document.querySelector('.card').innerHTML='<h2>GAME OVER</h2><p>Score '+score+'. <button onclick="location.reload()">RETRY</button></p>';}
render();
</script>

Put NOTHING else on the surface — the game IS the answer.
"""


def _fallback_surface(title: str, body: str) -> str:
    """A minimal valid surface so the client ALWAYS gets a surfaceId and never
    hangs on 'Building your level'. Used when the composer returns no usable
    tool call (e.g. truncation) or the model errors."""
    return a2ui.render(
        operations=[
            a2ui.create_surface("dynamic-surface", catalog_id=CATALOG_ID),
            a2ui.update_components(
                "dynamic-surface",
                [
                    {"id": "root", "component": "Stack", "gap": "md",
                     "children": ["fb-h", "fb-c"]},
                    {"id": "fb-h", "component": "Heading", "level": "2", "text": title},
                    {"id": "fb-c", "component": "Callout", "tone": "warning",
                     "title": "Try again", "body": body},
                ],
            ),
        ]
    )


@tool()
def generate_a2ui(runtime: ToolRuntime[Any]) -> str:
    """Render the answer to the user's question as an A2UI surface.

    It reads the conversation directly — the most recent `[Document: ...]`
    lecture and the user's request — plus the available A2UI catalog from
    context, then designs the surface and returns the operations for the
    client to render IN ONE PASS (no separate extraction step). You do NOT
    pass any arguments. It picks up everything from state.
    """
    messages = runtime.state["messages"][:-1]
    context_entries = runtime.state.get("copilotkit", {}).get("context", [])
    context_text = "\n\n".join(
        entry.get("value", "")
        for entry in context_entries
        if isinstance(entry, dict) and entry.get("value")
    )

    # The runtime context only carries the basic catalog. Append our
    # custom catalog spec so the secondary LLM picks our components, not
    # the generic A2UI primitives.
    custom_catalog_note = (
        f"\n\n## Use THIS catalog (NOT the basic one above):\n"
        f"catalogId: {CATALOG_ID}\n\n"
        f"{CATALOG_PROMPT}\n"
    )

    # Detect intent so we attach ONLY the directive that's needed — a smaller
    # prompt is faster to process and keeps the model focused. Mini-game turns
    # get the game directive; every other turn gets the workspace + sim one.
    last_user = ""
    for _m in reversed(messages):
        if getattr(_m, "type", "") in ("human", "user") or getattr(_m, "role", "") == "user":
            _c = getattr(_m, "content", "")
            last_user = _c if isinstance(_c, str) else str(_c)
            break
    is_minigame = any(
        k in last_user.lower() for k in ("mini-game", "minigame", "5-level", "play a mini")
    )

    prompt = (
        f"{context_text}\n{custom_catalog_note}\n"
        "Design the surface using ONLY components from the catalog above. "
        "The most recent `[Document: ...]` message in the conversation is the "
        "lecture — READ IT DIRECTLY and base the surface on its actual content "
        "(there is no pre-extracted summary; you do the reading here). "
        "Inline all data (use plain values, not {{path}} bindings, unless a "
        "property explicitly accepts a path). The user's request is in the "
        "most recent messages. Honor the words they used (chart type, "
        "comparison, etc.). Keep it FOCUSED and small — fewer, well-chosen "
        "components render far faster than a kitchen sink.\n\n"
        "Call render_a2ui exactly once. Pass the COMPLETE component tree as "
        "a JSON array STRING in `components_json` — every node is an object "
        "carrying its real catalog props inline (id, component, plus "
        "text/children/data/columns/value/label/items/etc. for that "
        "component type). Exactly one node has id=\"root\" and every other "
        "node must be reachable from it via a parent's children/child. Put "
        "chart `data` arrays inline on the chart node. Only use `data_json` "
        "(a JSON object string) if you bind a property via {path}; otherwise "
        "pass \"{}\". Emit STRICT JSON in both string params (double-quoted "
        "keys, no trailing commas, no comments)."
    ) + (PIXEL_MINIGAME_DIRECTIVE if is_minigame else LAYOUT_COLOR_DIRECTIVE + PIXEL_SIM_DIRECTIVE)

    model_with_tool = _render_model().bind_tools(
        [render_a2ui], tool_choice="render_a2ui"
    )

    print(
        f"[generate_a2ui] composing | minigame={is_minigame} "
        f"msgs={len(messages)} prompt_chars={len(prompt)} "
        f"last_user={last_user[:90]!r}",
        flush=True,
    )

    try:
        response = model_with_tool.invoke([SystemMessage(content=prompt), *messages])
    except Exception as exc:  # noqa: BLE001 — surface as data, never crash the stream
        print(f"[generate_a2ui] MODEL ERROR: {type(exc).__name__}: {exc}", flush=True)
        return _fallback_surface(
            "Generation failed",
            f"The model call errored ({type(exc).__name__}). Tap ↑ NEW LECTURE "
            "to retry. (Check the [agent] logs for the full error.)",
        )

    # Why a tool call did/didn't come back. finish_reason='MAX_TOKENS' means the
    # output cap truncated it before the forced render_a2ui call completed.
    meta = getattr(response, "response_metadata", None) or {}
    finish = meta.get("finish_reason") or meta.get("stop_reason") or "?"
    n_calls = len(response.tool_calls or [])
    print(
        f"[generate_a2ui] response | tool_calls={n_calls} finish_reason={finish!r}",
        flush=True,
    )

    if not response.tool_calls:
        # No usable tool call (most often: truncated at the output cap, so the
        # forced render_a2ui args never finished). Emit a real surface anyway so
        # the client always gets a surfaceId and never hangs — a calm retry card
        # beats an infinite spinner. Log WHY so it's diagnosable.
        content_preview = str(getattr(response, "content", ""))[:300]
        print(
            f"[generate_a2ui] NO TOOL CALL -> fallback | finish_reason={finish!r} "
            f"content[:300]={content_preview!r}",
            flush=True,
        )
        return _fallback_surface(
            "Couldn't build the level",
            "The generator ran out of room composing this surface. Tap ↑ NEW "
            "LECTURE (or re-send) to retry — a shorter prompt or fewer slides "
            "usually works.",
        )

    args = response.tool_calls[0]["args"]
    surface_id = args.get("surfaceId", "dynamic-surface")
    catalog_id = args.get("catalogId", CATALOG_ID)

    # The component tree + data model ride in as JSON STRING params (scalar
    # params survive Gemini's tool-arg parser; typed object/array params get
    # their undeclared keys stripped). Parse them here. Degrade gracefully on
    # malformed JSON so a bad turn renders an empty surface instead of
    # crashing the agent loop.
    components_json = args.get("components_json", "[]")
    data_json = args.get("data_json", "{}")
    print(
        f"[generate_a2ui] tool args | components_json_chars={len(components_json or '')} "
        f"data_json_chars={len(data_json or '')}",
        flush=True,
    )
    try:
        components = json.loads(components_json) if components_json else []
    except (json.JSONDecodeError, TypeError) as exc:
        print(
            f"[generate_a2ui] PARSE FAIL components_json ({len(components_json or '')} chars): "
            f"{exc} | tail={str(components_json)[-120:]!r}",
            flush=True,
        )
        components = []
    try:
        data = json.loads(data_json) if data_json else {}
    except (json.JSONDecodeError, TypeError) as exc:
        print(f"[generate_a2ui] PARSE FAIL data_json: {exc}", flush=True)
        data = {}

    print(
        f"[generate_a2ui] OK | {len(components)} components surface={surface_id!r} "
        f"finish_reason={finish!r}",
        flush=True,
    )

    ops = [
        a2ui.create_surface(surface_id, catalog_id=catalog_id),
        a2ui.update_components(surface_id, components),
    ]
    if data:
        ops.append(a2ui.update_data_model(surface_id, data))

    return a2ui.render(operations=ops)


SYSTEM_PROMPT = f"""\
You answer questions about a user's attached PDF and render the answer
as an A2UI surface using our custom catalog.

## Where the PDF lives

The frontend extracts the PDF text and inlines it into the user's
message under a `[Document: <filename>]` header. The PDF may have been
attached on the CURRENT turn or on ANY EARLIER turn in this conversation.
A user typically attaches a PDF once and then asks several follow-up
questions about it without re-attaching.

## How to find the PDF text

Scan the entire conversation history (every user message, oldest to
newest). Find the MOST RECENT user message that contains a
`[Document: <filename>]` header. That message's body is the active PDF
text and applies to every subsequent follow-up question UNTIL the user
attaches a different PDF.

Only if NO message in the history has ever contained a
`[Document: ...]` header should you ask the user to attach a PDF.

## Your tools

- `web_research(query)` — searches the LIVE web. Use it ONLY when the learner
  wants to go BEYOND the course: the latest developments, real-world examples,
  current numbers / rates / prices, recent news, "what's happening now with
  X". Returns JSON {{query, answer, sources:[{{title,url,snippet,favicon}}]}}.
- `generate_a2ui()` — reads the lecture text + the conversation and renders the
  answer as an A2UI surface in ONE pass (it does its own reading; there is NO
  separate extraction step). It is ALWAYS the LAST tool call of the turn. No
  arguments; it reads everything from state.

## How a turn MUST go (do not deviate)

Pick the flow, then ALWAYS finish with exactly one `generate_a2ui()` call.
`generate_a2ui` reads the most recent `[Document: ...]` lecture from the
conversation itself, so the common case is a SINGLE tool call — no extraction
round-trip.

1. STUDY FLOW — the default ("explain X", "make flashcards", "quiz me",
   "summarize chapter 3"): the answer lives in the lecture.
   a. If NO message in history has a `[Document: ...]` header, reply with one
      sentence: "Attach a PDF and I'll render the answer." STOP. No tool.
   b. Otherwise: make exactly ONE call to `generate_a2ui()`. STOP.

2. GO-DEEPER / WEB FLOW — the learner asks for the latest / real-world /
   current / live / recent-news angle.
   a. ONE or TWO calls to `web_research(query=...)`, each a specific,
      self-contained query.
   b. ONE call to `generate_a2ui()`. STOP.

3. MINI-GAME FLOW — the learner asks to PLAY a mini-game (mentions "mini-game",
   "play", or "5-level"). Make exactly ONE call to `generate_a2ui()` (it builds
   the game straight from the lecture in history). STOP.

After `generate_a2ui()` returns you are DONE. Do not call any more tools.
Do not write any chat content. Your final assistant message MUST be an
empty string. The rendered surface IS the user-visible answer.

## Absolute hard rules. Breaking ANY of these causes a crash.

- After `generate_a2ui` returns, you are DONE for this turn. Do not call
  `web_research` or `generate_a2ui` again. Do not write anything except an
  empty string.
- NEVER include the web_research JSON or any tool's return value in your reply.
- NEVER quote the PDF text, summarize the document, or echo any part of
  `pdf_text` back into the chat.
- The chat reply MUST be either empty ("") or a single very short
  sentence (under 10 words). Empty is preferred.

## Layout guidance for generate_a2ui

The secondary LLM sees the same conversation you do. When the user is
specific ("three line charts stacked", "side-by-side cards"), the
secondary LLM will honor it. Defaults per shape_hint:

- `flashcards` -> Stack(Section(title="Flashcards") -> Grid(columns=2) of
                  Flashcard nodes). One Flashcard per item in data, with
                  front/back (and hint if present) inlined. This is the
                  default when the user asks for flashcards or to memorize.
- `quiz`  -> If the user asks to "play", be "tested", or "compete", use ONE
              QuizGame node with the full `questions` array inlined (it is a
              scored game). Otherwise use a Stack of QuizQuestion nodes (one
              per item) for a plain self-check. Either way inline question,
              options, correctIndex, and explanation.
- A RateShockSimulator node is available for interest-rate-risk questions
  about bond price sensitivity: pass faceValue, couponRate, maturityYears,
  ytm, frequency (couponRate/ytm are annual percents). Use it when the user
  wants to "see" or "play with" how a bond's price reacts to rate changes.
- A SimulationLab node is the CENTERPIECE interactive: a playable 16-bit lab
  where the student tunes sliders and FIREs to hit a target (with a predicted
  arc + hit/miss verdict). Whenever the topic has ANYTHING dynamic, physical,
  or quantitative to play with (motion, forces, rates, growth, optimization,
  "what happens if I change X"), INCLUDE a SimulationLab near the top — set its
  `title` and `subject` to the course (e.g. title "🚀 Launch Lab", subject
  "PHYSICS · LVL 2"). Prefer it over a static chart when the learner could
  experiment.
- `stat`  -> Stack(Overline, StatCard)
- `trend` -> Stack(Section -> Card -> LineChart)
- `share` -> Stack(Section -> Card -> DonutChart)
- `table` -> Stack(Section -> Card -> DataTable)
- `text`  -> Rich explainer. Compose multiple components, not just one Card:
              Stack(
                Overline(topic),
                Heading(title),
                Text(intro paragraph, 2-4 sentences),
                Callout(tone=info, title="Key idea", body=core insight),
                Section(title="Why it matters", child=Card(Text(...))),
                BulletList(items=[3 key points]),
              )
              Use Callout for the "headline takeaway", BulletList for
              enumerations, and Text for paragraphs. Mix with one chart
              ONLY if the question genuinely benefits from data viz.

### Rendering web_research results (the go-deeper surface)

When the conversation contains a `web_research` result (JSON with `answer`
and `sources`), you have FULL creative freedom — this is the moment to show
off generative UI. There is no fixed template:

- Lead with the synthesized `answer`: a Heading + Text explainer, or a
  Callout for the headline takeaway followed by Text paragraphs.
- Make every claim attributable. Render `sources` as clickable citations —
  a BulletList of titles, or a Stack/Grid of Cards (title + snippet + url).
- For a richer "research briefing" look, author a **FreeformUI** surface:
  a bespoke layout of source cards, a comparison panel, an annotated diagram,
  a timeline. Reach for FreeformUI whenever the structured catalog feels too
  plain for the answer you want to show. Keep it fully self-contained per the
  FreeformUI catalog rules: NO external URLs, fonts, or images — so do NOT
  embed a source `favicon` URL inside FreeformUI (the sandbox blocks it; show
  the title + url text instead). The `favicon` field is provided for a future
  React Citation component, which can load it.
- If the result has an `error` field, render a small, calm Callout
  (tone=warning): "Couldn't reach the web for that — here's what the lecture
  says" and fall back to the lecture content if available.

This is a study tool for lecture material. Prefer `flashcards` and `quiz`
when the user asks to study, memorize, or test themselves; prefer the rich
`text` layout for "explain X" questions. Skip charts unless the user
explicitly asks for data viz.

## Restating the loop guard

- `generate_a2ui` is ALWAYS the final tool call, exactly once.
- Before it: NOTHING for the study / mini-game flow (generate_a2ui reads the
  lecture itself — a single call), OR `web_research` one-to-two times first for
  the go-deeper flow.
- After generate_a2ui returns, STOP IMMEDIATELY.
- Never describe the surface in prose. The surface IS the answer.

{CATALOG_PROMPT}
"""


def build_dynamic_agent():
    # _LazyRenderModel defers the Gemini client construction to first use, so
    # building the graph at import never needs a key. /dynamic still requires
    # a key the moment a request hits it (the proxy constructs the real model
    # then). Online behavior is unchanged.
    return create_agent(
        model=_LazyRenderModel(),
        tools=[web_research, generate_a2ui],
        middleware=[CopilotKitMiddleware()],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
    )


graph = build_dynamic_agent()
