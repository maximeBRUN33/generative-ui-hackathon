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
    emoji: str


class Progress(TypedDict):
    label: str
    value: float
    tone: str


class QuizItem(TypedDict):
    question: str
    options: list[str]
    correctIndex: int
    explanation: str


class GraphParam(TypedDict):
    name: str
    min: float
    max: float
    value: float


class CMNode(TypedDict):
    id: str
    label: str
    level: int


# `from` is a Python keyword, so CMEdge must be defined functionally.
CMEdge = TypedDict("CMEdge", {"from": str, "to": str})


@tool
def render_workspace(
    eyebrow: str,
    title: str,
    subtitle: str,
    concepts: list[Concept],
    progress: list[Progress],
    takeaway: str,
    concept_nodes: list[CMNode],
    concept_edges: list[CMEdge],
    graph_title: str,
    graph_expression: str,
    graph_params: list[GraphParam],
    graph_x_min: float,
    graph_x_max: float,
    quiz: list[QuizItem],
) -> str:
    """Render the interactive study workspace for the lecture PDF.

    This is Copilearn's content-adaptive learning environment: a concept map,
    topic cards, an interactive function grapher, a scored quiz, and a mastery
    tracker. Pass data INLINE. Call ONCE per turn.

    Required shapes:
      - concepts: EXACTLY 6 flip-cards. Each {name, definition, difficulty, emoji}.
          * `name`       = the concept/term, short (<= 4 words). Shown on the
                           card front.
          * `definition` = ELI5. Explain it like the reader is a smart 12-year-old
                           who has never seen the topic: ONE short sentence, plain
                           words, ideally a tiny everyday analogy. NO jargon, NO
                           formulas. This is the card back. (e.g. for duration:
                           "How long, on average, until you get your money back —
                           longer means the price swings more when rates move.")
          * `difficulty` = ONE word: "Core", "Intermediate", or "Advanced".
          * `emoji`      = ONE emoji that visually hints the idea (e.g. 📉 ⏳ 🎢 🛡️).
        If the lecture has fewer than 6 headline concepts, split the richest
        ones so you always return exactly 6.

      - progress: ONE entry per concept (6), SAME order. {label, value, tone}.
          * `value` = mastery percent 0–100 (0 on the first render).
          * `tone`  = "default" | "positive" | "warning".

      - takeaway: ONE sentence — the single most important idea.

      - concept_nodes / concept_edges: the concept map. nodes are
        {id, label, level} where level 0 = earliest topic (left), and edges are
        {from, to} (referencing node ids) showing how concepts build on each
        other. Usually mirror the 6 concepts plus any capstone.

      - graph_*: an interactive function for the EXPLORE section.
          * graph_expression = a formula in `x` plus any named params, e.g.
            "a*x^2 + b*x + c". Supports + - * / ^, parentheses, unary minus,
            sin/cos/tan/exp/ln/log/sqrt/abs, constants pi/e.
          * graph_params = sliders {name, min, max, value} for each param used
            in the expression (use the SAME names as in the expression).
          * graph_x_min / graph_x_max = the x-axis range to plot over.
        Pick a function genuinely from the lecture (a key example or an
        objective to optimize).

      - quiz: 6–8 multiple-choice questions {question, options (4 strings),
        correctIndex (0-based), explanation}. Make it feel like real exam prep,
        not just definition recall: mix EASY warm-ups, APPLICATION questions
        ("given X, what happens to Y?"), and 1–2 HARDER ones that combine
        concepts or use small numbers from the lecture. Plausible distractors;
        a one-line explanation each. correctIndex MUST point at the right option.
    """
    payload = {
        "eyebrow": eyebrow,
        "title": title,
        "subtitle": subtitle,
        "concepts": concepts,
        "progress": progress,
        "takeaway": takeaway,
        "conceptMap": {"nodes": concept_nodes, "edges": concept_edges},
        "graph": {
            "title": graph_title,
            "expression": graph_expression,
            "params": graph_params,
            "xRange": [graph_x_min, graph_x_max],
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
into a live study workspace whose interface is GENERATED FROM THE CONTENT: a
concept map, topic cards, an interactive function grapher, a scored quiz, and a
mastery tracker.

This deployment is tuned for MATH / quantitative lectures (functions, graphs,
differentiation, optimization, and their applications — including
utility/risk and portfolio optimization). Teach clearly, for a student seeing
the material for the first time.

## How a turn works

  A) Attach a lecture PDF + chat (initial render).
  B) Send a chat message ("focus on optimization", "explain stationary points",
     "make the quiz harder", "more practice").
  C) Tap a node in the concept map. The runtime delivers this as a tool result
     `log_a2ui_event`:
        User performed action "focus_topic" on surface "study-workspace".
        Context: {{"topic": "Optimization", "id": "optimization"}}

In every case, decide whether to re-render the workspace, answer in chat, or both.

## The render contract

Call `render_workspace(...)` ONCE with structured data:
  - 6 concepts {{name, definition, difficulty}} drawn from the lecture.
  - progress: one per concept (6), same order, value 0 on first render.
  - takeaway: the single most important idea, one sentence.
  - concept_nodes / concept_edges: a concept map of how the topics build on
    each other (level 0 = earliest), usually mirroring the 6 concepts.
  - graph_*: an interactive function genuinely from the lecture — a key example
    (e.g. "a*x^2 + b*x + c") or an objective to optimize — with slider params
    and an x-range.
  - quiz: 4–6 scored multiple-choice questions from the lecture.

When the user focuses a topic (chat or a concept-map tap):
  - Re-call render_workspace with the SAME surfaceId. Keep the 6 concepts but
    deepen the FOCUSED concept's definition, and you may point graph_* at a
    function for that topic. Keep quiz stable unless asked to change it.
When the user asks for "harder" / "more practice": regenerate the quiz with
tougher questions.

## Hard rules

- Render the workspace when the user attaches a PDF, asks to re-focus, or taps
  a concept node.
- Call `render_workspace` AT MOST ONCE per turn. Never twice.
- Teach from what is ACTUALLY in the lecture. Clear, beginner-friendly.
- For a quick conceptual question that needs no layout change, answer in chat
  (1–3 sentences) without re-rendering.
- For ad-hoc flashcards or a one-off quiz, point them to "Study tools" (Dynamic).

## Chat tone

Warm, encouraging, brief — like a good TA. After the first render suggest one or
two next steps ("Drag the a-slider negative to flip the parabola" or "Tap
*Optimization* in the map for the deeper version"). Max two.

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
