"""Fixed-schema dashboard agent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMIZATION SEAM #5 — Swap the agent flow (fixed-schema dashboard)
See HACKATHON.md §5 for the full recipe. For a different fixed dashboard,
rewrite the layout JSON at agent/src/a2ui/schemas/dashboard.json and the
`render_dashboard` tool's typed inputs; reword the system prompt for your
domain. The dynamic Q&A flow lives in dynamic_agent.py.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user attaches a PDF in the chat. The deep agent reads the PDF text
(inlined into the user message by InlineDocumentsMiddleware) and calls
`render_dashboard` with the structured data extracted in the same model
pass. The dashboard surface includes an interactive scope-chips strip
that the agent populates from the document. Clicking a chip fires a
user action back to the agent, which re-renders with the new scope.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import TypedDict

from copilotkit import CopilotKitMiddleware, a2ui
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver

from src.catalog import CATALOG_ID, CATALOG_PROMPT

SCHEMA_DIR = Path(__file__).parent / "a2ui" / "schemas"
WORKSPACE_SCHEMA = a2ui.load_schema(SCHEMA_DIR / "workspace.json")
SURFACE = "study-workspace"


# NOTE (Gemini typed-array fix): every list parameter on render_workspace
# below is typed as `list[<TypedDict>]`, NOT `list[dict]`. Gemini's
# function-declaration validator rejects untyped arrays with
# "parameters.properties[X].items: missing field". A TypedDict compiles to a
# concrete object schema, so these arrays carry the `items` Gemini requires.
# Keep them typed — do not loosen to `list[dict]`.
class Concept(TypedDict):
    name: str
    definition: str
    difficulty: str


class Progress(TypedDict):
    label: str
    value: float
    tone: str


class ScopeOption(TypedDict):
    label: str
    value: str


class QuizItem(TypedDict):
    question: str
    options: list[str]
    correctIndex: int
    explanation: str


@tool
def render_workspace(
    eyebrow: str,
    title: str,
    subtitle: str,
    concepts: list[Concept],
    progress: list[Progress],
    takeaway: str,
    scope_options: list[ScopeOption],
    scope_selected: str,
    bond_face_value: float,
    bond_coupon_rate: float,
    bond_maturity_years: float,
    bond_ytm: float,
    bond_frequency: int,
    quiz: list[QuizItem],
) -> str:
    """Render the interactive study + game workspace for the lecture PDF.

    This is Copilearn's learning environment: concept cards, a mastery
    tracker, an interactive rate-shock simulator, and a scored quiz game.
    Pass data INLINE. Call ONCE per turn.

    Required shapes:
      - concepts: EXACTLY 6 cards. Each {name, definition, difficulty}.
          * `name`       = the concept/term, short. <= 5 words.
          * `definition` = a plain-language, student-friendly explanation in
                           1–2 sentences. Make it genuinely clear.
          * `difficulty` = ONE word badge: "Core", "Intermediate", or
                           "Advanced".
        If the lecture has fewer than 6 headline concepts, split the richest
        ones so you always return exactly 6.

      - progress: ONE entry PER concept (6), SAME order. {label, value, tone}.
          * `value` = mastery percent 0–100. On the FIRST render set every
                      value to 0 (nothing mastered yet).
          * `tone`  = "default" | "positive" | "warning".

      - takeaway: ONE sentence — the single most important idea.

      - scope_options: an "Overview" chip plus one per major concept.
      - scope_selected: "overview" on first render; else the clicked value.

      - bond_*: parameters for the rate-shock simulator, taken from the
        lecture's worked bond example if it has one (else a representative
        bond). couponRate and ytm are ANNUAL percents (e.g. 9 for 9%).
        bond_frequency = coupons per year (2 for semi-annual).

      - quiz: 4–6 multiple-choice questions for the scored game. Each
        {question, options (4 strings), correctIndex (0-based), explanation}.
        Write plausible distractors and test real understanding of the
        lecture. correctIndex MUST point at the right option.
    """
    payload = {
        "eyebrow": eyebrow,
        "title": title,
        "subtitle": subtitle,
        "concepts": concepts,
        "progress": progress,
        "takeaway": takeaway,
        "scope": {"options": scope_options, "selected": scope_selected},
        "bond": {
            "faceValue": bond_face_value,
            "couponRate": bond_coupon_rate,
            "maturityYears": bond_maturity_years,
            "ytm": bond_ytm,
            "frequency": bond_frequency,
        },
        "quiz": quiz,
    }
    return a2ui.render(
        operations=[
            a2ui.create_surface(SURFACE, catalog_id=CATALOG_ID),
            a2ui.update_components(SURFACE, WORKSPACE_SCHEMA),
            a2ui.update_data_model(SURFACE, payload),
        ]
    )


SYSTEM_PROMPT = f"""\
You are Copilearn, a study coach. You turn a student's lecture slides (a PDF)
into a live study + game workspace: the key concepts, plain-language
definitions, a mastery tracker, an interactive rate-shock simulator, and a
scored quiz game.

This deployment is focused on a finance "Interest Rate Risk" lecture (bonds,
price–yield relationship, Macaulay & modified duration, convexity,
immunization, price vs reinvestment risk). Teach it clearly to an audience
that may be new to bonds.

## How a turn works

The user may do three things on any turn:
  A) Attach a new lecture PDF + chat (initial render).
  B) Send a chat message ("focus on convexity", "explain duration in plain
     English", "why does immunization work?").
  C) Click a concept chip on the workspace. The runtime delivers this as a
     tool result `log_a2ui_event` with content like:
        User performed action "select_chip" on surface "study-workspace".
        Context: {{"value": "convexity", "label": "Focus a concept"}}

In every case, decide whether to re-render the workspace, answer in chat,
or both.

## The render contract

When you render, call `render_workspace(...)` ONCE with structured data:
  - EXACTLY 6 concepts {{name, definition, difficulty}}.
  - `progress`: one per concept (6), same order, value 0 on first render.
  - `takeaway`: the single most important idea, one sentence.
  - `scope_options`: an "Overview" chip plus one per major concept.
  - `scope_selected`: "overview" on first render; else the clicked value.
  - bond_* : the lecture's worked bond if it has one (e.g. a 9% coupon,
    5-year, semi-annual bond at 9% YTM → face 1000, coupon 9, maturity 5,
    ytm 9, frequency 2). couponRate/ytm are ANNUAL percents.
  - quiz: 4–6 scored multiple-choice questions drawn from the lecture, with
    good distractors and a one-line explanation each.

When the user (or a chip click) focuses a concept:
  - Re-call render_workspace with the SAME surfaceId. Keep the 6 concepts but
    rewrite the FOCUSED concept's definition to be deeper, and set
    scope_selected to the focused value. Keep bond_* and quiz stable across
    re-renders unless the user asks to change them.

## Hard rules

- Render the workspace whenever the user attaches a PDF (initial), asks to
  re-focus, or clicks a chip.
- Call `render_workspace` AT MOST ONCE per turn. Never twice.
- Teach from what is ACTUALLY in the lecture. Definitions must be clear and
  beginner-friendly (assume the audience does not know bonds).
- If the user asks a quick conceptual question that does NOT need a layout
  change, answer in chat (1–3 sentences, plain language) without re-rendering.
- For ad-hoc flashcards or a one-off quiz, point them to "Study tools" (the
  Dynamic tab).

## Chat tone

Warm, encouraging, brief — like a good TA. After the first render, suggest
one or two next steps ("Drag the simulator's slider to +400 bps and watch
duration miss" or "Tap *Convexity* for the deeper version"). Max two.

{CATALOG_PROMPT}
"""


# Gemini 3.5 Flash via the native Google Gen AI SDK — same provider as the
# dynamic agent and the PDF extractor (see FROZEN.md "LLM provider"). The
# native SDK replays Gemini's thought_signature across tool turns, which the
# OpenAI-compat path does not.
#
# Constructed lazily (not at import time): ChatGoogleGenerativeAI validates
# the API key in its constructor and raises with no key. Building it lazily
# lets `import main` succeed with OFFLINE=1 and no key (the offline branch of
# build_fixed_agent never touches the live model). Online behavior is
# unchanged — the client is built on the first build_fixed_agent() call.
def _build_model() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=os.getenv("MODEL", "gemini-3.5-flash"),
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )


def build_fixed_agent():
    if os.getenv("OFFLINE") == "1":
        # CUSTOMIZATION SEAM (offline): no Gemini call, no API key. A
        # deterministic stub chat model drives the REAL create_agent ReAct
        # loop + the REAL render_dashboard tool, so the emitted A2UI envelope
        # is byte-for-byte the production shape (createSurface +
        # updateComponents + updateDataModel wrapped in a2ui_operations).
        from src.offline_fixed import build_offline_fixed_agent

        return build_offline_fixed_agent(render_workspace, SYSTEM_PROMPT)

    return create_agent(
        model=_build_model(),
        tools=[render_workspace],
        # CopilotKitMiddleware forwards frontend tools + agent context (e.g.
        # useAgentContext payloads) to the LLM.
        middleware=[CopilotKitMiddleware()],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
    )


graph = build_fixed_agent()
