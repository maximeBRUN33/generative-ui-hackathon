# Copilearn v2 — agent ↔ UI contract

This is the integration spec between the **agent lane** (classify a lecture PDF →
emit a plan) and the **UI lane** (catalog widgets that render it). Build against
this so the two halves slot together.

## Flow

```
PDF ──(classify)──► LecturePlan JSON ──(plan)──► A2UI surface ──► rendered widgets
        agent             Layer 1          agent      Layer 2         frontend
```

The widget planner does NOT need a new frontend renderer: it composes the
existing A2UI catalog (now including the math widgets). The "plan" is just the
agent choosing catalog components per section.

## Layer 1 — `LecturePlan`

TypeScript source of truth: [`src/lib/lecture-plan.ts`](../src/lib/lecture-plan.ts).
Shape:

```jsonc
{
  "subject": "math",                  // math | life_sciences | finance | theory | procedural
  "title": "Functions of 2 Variables",
  "confidence": 0.9,
  "sections": [
    { "id": "functions", "title": "Functions", "summary": "...",
      "widget": "graph_explorer",
      "widgetProps": { "expression": "a*x^2", "params": [{ "name": "a", "min": -2, "max": 2, "value": 1 }], "xRange": [-4, 4] } }
  ],
  "conceptMap": { "nodes": [{ "id": "fn", "label": "Functions", "level": 0 }], "edges": [{ "from": "fn", "to": "deriv" }] },
  "takeaway": "..."
}
```

## Layer 2 — widget → catalog component

The planner emits an A2UI surface using these component names (props mirror
`agent/src/catalog.py` `CATALOG_PROMPT`):

| `section.widget` | A2UI component | notes |
|---|---|---|
| `graph_explorer` | `GraphExplorer` | `expression` in x + named `params` (sliders); also use for optimization (plot objective → max/min) |
| `concept_map` | `ConceptMap` | usually emitted once as the lecture overview, from `plan.conceptMap` |
| `topic_card` | `Card` → `Stack(Heading, Text, Badge)` | definitions / theory |
| `quiz` | `QuizGame` | scored; `questions[]` |
| `flashcards` | `Grid` of `Flashcard` | term/definition recall |
| `mastery` | `ProgressTracker` | one bar per concept |
| `simulation` | `RateShockSimulator` | **finance** subject path (utility/risk, bonds) |

## Interactions (agent behaviours)

Surface actions arrive as a `log_a2ui_event` tool result on the next run:
- `ConceptMap` node tap → `focus_topic` `{ topic, id }` → re-render focused on it.
- chips / buttons → `select_chip` etc. (existing pattern).
- "harder" / "more practice" / "focus on X" in chat → regenerate the relevant
  section (e.g. a harder `QuizGame`, more `Flashcard`s).

## Subjects

v1 implements **math/stats** end to end; **finance** is reusable via
`RateShockSimulator` + the existing IRR widgets. Other subjects extend
`WidgetType` + the table as their widgets are added.
