"""Linkup web-search tool — the Teacher Agent's "Go Deeper" live-web feature.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMIZATION SEAM — Linkup web search (agent lane)
The uploaded course is a closed box: the agent only knows what the PDF says.
`web_research` opens it. The dynamic agent calls it when the learner wants to
go BEYOND the lecture — the latest developments, real-world examples, current
numbers/rates/prices, recent news. See `dynamic_agent.py`'s SYSTEM_PROMPT for
the turn flow, and `docs/LINKUP-FOR-ALE.md` for the UI contract.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## The contract (this is the whole UI interface)

`web_research(query)` returns a JSON STRING with a stable, flat shape:

    {
      "query":   "<the query that was run>",
      "answer":  "<a synthesized, citeable answer>",
      "sources": [ { "title", "url", "snippet", "favicon" }, ... ],
      "error":   "<present ONLY on failure>"
    }

The result lands in the message history, so `generate_a2ui`'s secondary LLM
sees it for free and renders it — into Citation cards, a Callout + BulletList,
or a bespoke FreeformUI "research briefing". The renderer (and Alessandro on
the UI side) only ever needs to know this one shape.

## Why a plain server-side tool (not MCP / not a frontend tool)

Same reasoning as `generate_a2ui` in `dynamic_agent.py`: a real LangChain
`@tool` runs server-side, its result becomes a normal ToolMessage, and there
is no frontend-tool stripping / orphan-`function_call` trap. Linkup ships an
MCP server too, but a direct SDK tool keeps the whole flow inside one process
and one frozen dependency set.
"""
from __future__ import annotations

import json
import os

from langchain.tools import tool

# Lazy client — mirrors the lazy ChatGoogleGenerativeAI construction in
# dynamic_agent.py / pdf_tools.py. LinkupClient reads LINKUP_API_KEY in its
# constructor; building it on first use lets `import main` (and the graph
# build) succeed with no key set (OFFLINE / key-less boot). The study flow
# (query_pdf -> generate_a2ui) never touches Linkup, so only a genuine
# go-deeper turn requires the key.
_CLIENT = None


def _client():
    global _CLIENT
    if _CLIENT is None:
        from linkup import LinkupClient

        _CLIENT = LinkupClient(api_key=os.getenv("LINKUP_API_KEY"))
    return _CLIENT


@tool
def web_research(query: str) -> str:
    """Search the LIVE web for real-world, current, or beyond-the-course info.

    Call this when the learner asks about anything the uploaded course cannot
    answer on its own: the latest developments, real-world examples, current
    numbers / prices / rates, recent news, or "what's happening now with X".
    Do NOT call it for plain study questions answerable from the lecture —
    use `query_pdf` for those.

    Args:
        query: A specific, self-contained search query. Be concrete — include
            names, dates, and context (e.g. "current 10-year US Treasury yield
            January 2026", not "interest rates"). Each call is one focused
            question; issue two calls for two distinct sub-questions.

    Returns:
        A JSON string: {query, answer, sources:[{title,url,snippet,favicon}]}.
        On failure: {query, error} — so a bad web turn renders a graceful
        "couldn't reach the web" surface instead of crashing the agent loop.
    """
    try:
        resp = _client().search(
            query=query,
            depth="standard",          # one focused question -> snippets suffice
            output_type="sourcedAnswer",  # synthesized answer + citeable sources
        )
    except Exception as exc:  # noqa: BLE001 — agent-loop boundary: never crash a
        # turn on a web/network/credit error (same pattern as main.py's /legal
        # guard). Surface it as data so generate_a2ui can still render.
        print(f"[linkup_tools] web_research failed for {query!r}: {exc!r}")
        return json.dumps({"query": query, "error": str(exc), "sources": []})

    sources = [
        {
            "title": getattr(s, "name", "") or "",
            "url": getattr(s, "url", "") or "",
            "snippet": getattr(s, "snippet", "") or "",
            "favicon": getattr(s, "favicon", "") or "",
        }
        for s in (getattr(resp, "sources", None) or [])
    ]
    return json.dumps(
        {
            "query": query,
            "answer": getattr(resp, "answer", "") or "",
            "sources": sources,
        }
    )
