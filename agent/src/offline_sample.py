"""Canned study workspace for OFFLINE=1 mode — Copilearn, math demo.

When OFFLINE=1 is set, the /fixed agent serves this deterministic workspace with
NO Gemini call and no API key (see fixed_agent.py). It's the bulletproof stage
demo: the app opens straight to a generated math study environment (concept map
+ topic cards + function grapher + scored quiz + mastery tracker) with no upload
and no key.

These args are passed verbatim to `render_workspace(**OFFLINE_WORKSPACE_ARGS)`,
so the KEYS must match that tool's parameters exactly. Content is drawn from
QB Math Lecture 3 — "Functions of 2 variables" (Quantitative Business,
Maastricht; de Graaff): 1- and 2-variable functions, level curves,
parameterized curves, optimization, and portfolio optimization (utility & risk).
"""
from __future__ import annotations

from typing import Any

OFFLINE_WORKSPACE_ARGS: dict[str, Any] = {
    "eyebrow": "QUANTITATIVE BUSINESS · LECTURE 3",
    "title": "Functions, Graphs & Optimization",
    "subtitle": "From convex curves and stationary points to the math behind optimal portfolios.",
    "concepts": [
        {
            "name": "Functions of one variable",
            "definition": "A rule giving one output per input. Its shape is described by convexity and stationary points (where the slope is zero): f(x)=x² is convex with a minimum at x=0.",
            "difficulty": "Core",
        },
        {
            "name": "Functions of two variables",
            "definition": "z = f(x,y) is a surface. (1/10)x²+(2/10)y² is a convex bowl with a minimum at (0,0); g(x,y)=x·y has a saddle point.",
            "difficulty": "Core",
        },
        {
            "name": "Level curves",
            "definition": "Setting f(x,y)=c slices the surface at height c, tracing a curve in the xy-plane (e.g. ellipses for a paraboloid).",
            "difficulty": "Intermediate",
        },
        {
            "name": "Parameterized curves",
            "definition": "Points (x(t), y(t)) traced as the parameter t varies — a path in the plane: a line, a parabola, a circle, or a spiral.",
            "difficulty": "Intermediate",
        },
        {
            "name": "Optimization",
            "definition": "Find a maximum or minimum by setting the derivative to zero (the first-order condition). For an objective U(α), solve dU/dα = 0.",
            "difficulty": "Core",
        },
        {
            "name": "Portfolio optimization",
            "definition": "Maximize utility U = μ − r·σ² over the mix α. Risk aversion r penalizes variance; diversification (α = ½ here) beats holding a single asset.",
            "difficulty": "Advanced",
        },
    ],
    "progress": [
        {"label": "Functions of one variable", "value": 0, "tone": "default"},
        {"label": "Functions of two variables", "value": 0, "tone": "default"},
        {"label": "Level curves", "value": 0, "tone": "default"},
        {"label": "Parameterized curves", "value": 0, "tone": "default"},
        {"label": "Optimization", "value": 0, "tone": "default"},
        {"label": "Portfolio optimization", "value": 0, "tone": "default"},
    ],
    "takeaway": "Calculus is the engine of quantitative business: graph a function, set its derivative to zero, and you have the optimum — whether it's a curve's vertex or the best portfolio mix.",
    "concept_nodes": [
        {"id": "fn1", "label": "Functions (1 var)", "level": 0},
        {"id": "fn2", "label": "Functions (2 var)", "level": 1},
        {"id": "level", "label": "Level curves", "level": 1},
        {"id": "param", "label": "Parameterized curves", "level": 2},
        {"id": "opt", "label": "Optimization", "level": 2},
        {"id": "portfolio", "label": "Portfolio optimization", "level": 3},
        {"id": "capm", "label": "CAPM / One-Fund", "level": 4},
    ],
    "concept_edges": [
        {"from": "fn1", "to": "fn2"},
        {"from": "fn1", "to": "level"},
        {"from": "fn2", "to": "opt"},
        {"from": "level", "to": "param"},
        {"from": "opt", "to": "portfolio"},
        {"from": "param", "to": "portfolio"},
        {"from": "portfolio", "to": "capm"},
    ],
    "graph_title": "Function explorer:  a·x² + b·x + c",
    "graph_expression": "a*x^2 + b*x + c",
    "graph_params": [
        {"name": "a", "min": -2, "max": 2, "value": 1},
        {"name": "b", "min": -5, "max": 5, "value": 0},
        {"name": "c", "min": -5, "max": 5, "value": -3},
    ],
    "graph_x_min": -6,
    "graph_x_max": 6,
    "quiz": [
        {
            "question": "f(x) = x² is convex everywhere. Its stationary point at x = 0 is a…",
            "options": ["maximum", "minimum", "saddle point", "discontinuity"],
            "correctIndex": 1,
            "explanation": "A convex function curves upward, so its stationary point is a minimum.",
        },
        {
            "question": "g(x) = x³ at x = 0 is…",
            "options": ["a minimum", "a maximum", "a saddle / inflection point", "undefined"],
            "correctIndex": 2,
            "explanation": "x³ is convex for x>0 and concave for x<0 — neither a max nor a min.",
        },
        {
            "question": "A level curve of f(x, y) is the set of points where…",
            "options": ["x = 0", "f(x, y) = c, a constant", "the gradient is zero", "y = x"],
            "correctIndex": 1,
            "explanation": "Setting f(x,y)=c slices the surface at height c, tracing a curve in the xy-plane.",
        },
        {
            "question": "To find the portfolio mix that maximizes utility U(α), you…",
            "options": ["set U = 0", "set dU/dα = 0 (first-order condition)", "maximize the variance σ²", "always set α = 1"],
            "correctIndex": 1,
            "explanation": "Optimize by setting the derivative to zero: dU/dα = 0.",
        },
        {
            "question": "The optimal mix α = ½ gives utility 1.25 vs 1 for a single asset, so diversification…",
            "options": ["hurts the investor", "makes no difference", "helps — it raises risk-adjusted utility", "is impossible here"],
            "correctIndex": 2,
            "explanation": "Splitting across assets lowers variance, which raises risk-adjusted utility.",
        },
    ],
}
