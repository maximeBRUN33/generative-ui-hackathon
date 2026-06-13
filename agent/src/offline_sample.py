"""Canned study+game workspace for OFFLINE=1 mode — Copilearn, Lecture 7.

When OFFLINE=1 is set, the /fixed agent serves this deterministic Interest
Rate Risk workspace with NO Gemini call and no API key (see fixed_agent.py).
This is the bulletproof stage demo: the app opens straight to the Lecture 7
learning environment (concepts + mastery tracker + rate-shock simulator +
scored quiz) with no upload and no key required.

These args are passed verbatim to `render_workspace(**OFFLINE_WORKSPACE_ARGS)`,
so they MUST satisfy that tool's typed inputs (Concept / Progress /
ScopeOption / QuizItem + the bond_* scalars). Content is drawn from the RSM
BMOFI Investments "Interest Rate Risk" lecture (Dr. Vincenzo F. Fabrizio).
"""
from __future__ import annotations

from typing import Any

OFFLINE_WORKSPACE_ARGS: dict[str, Any] = {
    "eyebrow": "INVESTMENTS · LECTURE 7",
    "title": "Interest Rate Risk",
    "subtitle": "Why bond prices move with rates — and how duration, convexity, and immunization tame the risk.",
    "concepts": [
        {
            "name": "Price–yield relationship",
            "definition": "Bond prices move inversely to interest rates. When market yields rise, the price of an existing bond falls; when yields fall, its price rises.",
            "difficulty": "Core",
        },
        {
            "name": "What drives sensitivity",
            "definition": "A bond's price reacts MORE to rate changes when its maturity is longer, its coupon is lower, and its starting yield (YTM) is lower.",
            "difficulty": "Core",
        },
        {
            "name": "Macaulay duration",
            "definition": "The weighted-average time to receive a bond's cash flows — one number that captures its 'effective maturity' and its sensitivity to rates.",
            "difficulty": "Intermediate",
        },
        {
            "name": "Modified duration",
            "definition": "Duration divided by (1 + y). It estimates the % price change for a small yield move: ΔB/B ≈ −D* × Δy.",
            "difficulty": "Intermediate",
        },
        {
            "name": "Convexity",
            "definition": "The curvature of the price–yield line. Duration's straight-line estimate under-predicts price for large moves; convexity adds the correction back.",
            "difficulty": "Advanced",
        },
        {
            "name": "Immunization",
            "definition": "Match the duration of your assets to your liabilities (or your horizon) so price risk and reinvestment risk offset — rate moves no longer hurt you.",
            "difficulty": "Advanced",
        },
    ],
    "progress": [
        {"label": "Price–yield relationship", "value": 0, "tone": "default"},
        {"label": "What drives sensitivity", "value": 0, "tone": "default"},
        {"label": "Macaulay duration", "value": 0, "tone": "default"},
        {"label": "Modified duration", "value": 0, "tone": "default"},
        {"label": "Convexity", "value": 0, "tone": "default"},
        {"label": "Immunization", "value": 0, "tone": "default"},
    ],
    "takeaway": "Interest-rate risk comes down to one number — duration — and one correction — convexity; match duration to your horizon to neutralize it.",
    "scope_options": [
        {"label": "Overview", "value": "overview"},
        {"label": "Price–Yield", "value": "price_yield"},
        {"label": "Duration", "value": "duration"},
        {"label": "Convexity", "value": "convexity"},
        {"label": "Immunization", "value": "immunization"},
    ],
    "scope_selected": "overview",
    # The lecture's worked bond: 9% coupon, $1000 face, 5 years, semi-annual,
    # YTM 9% (prices at par; Macaulay duration ≈ 8.27 half-years ≈ 4.13 years).
    "bond_face_value": 1000,
    "bond_coupon_rate": 9,
    "bond_maturity_years": 5,
    "bond_ytm": 9,
    "bond_frequency": 2,
    "quiz": [
        {
            "question": "If market interest rates rise, what happens to the price of an existing bond?",
            "options": ["It rises", "It falls", "It stays the same", "It always goes to par"],
            "correctIndex": 1,
            "explanation": "Bond prices move inversely to yields — higher rates make existing, lower-coupon bonds worth less.",
        },
        {
            "question": "Which bond is MOST sensitive to a change in interest rates?",
            "options": [
                "Short maturity, high coupon",
                "Long maturity, low coupon",
                "Short maturity, low coupon",
                "Long maturity, high coupon",
            ],
            "correctIndex": 1,
            "explanation": "Sensitivity rises with longer maturity and lower coupons (and lower starting YTM).",
        },
        {
            "question": "Macaulay duration measures…",
            "options": [
                "A bond's credit risk",
                "The weighted-average time to its cash flows",
                "The coupon rate",
                "The probability of default",
            ],
            "correctIndex": 1,
            "explanation": "Duration is the weighted-average time to receive the bond's cash flows — its 'effective maturity'.",
        },
        {
            "question": "Modified duration gives a price-change estimate, but…",
            "options": [
                "It is always exact",
                "It under-predicts the price for large yield moves",
                "It only works for zero-coupon bonds",
                "It ignores time to maturity",
            ],
            "correctIndex": 1,
            "explanation": "It's a linear (straight-line) approximation; convexity corrects the error as moves get larger.",
        },
        {
            "question": "Immunizing a portfolio against interest-rate risk means…",
            "options": [
                "Holding only cash",
                "Matching asset duration to the liability or investment horizon",
                "Buying the highest-convexity bond available",
                "Avoiding bonds entirely",
            ],
            "correctIndex": 1,
            "explanation": "Matching durations makes price risk and reinvestment risk offset, locking in the realized yield.",
        },
    ],
}
