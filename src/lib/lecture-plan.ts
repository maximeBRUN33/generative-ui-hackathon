/**
 * The Copilearn lecture-plan contract (v2).
 *
 * This is the shared interface between the AGENT lane (Maxime: classify a PDF →
 * emit this JSON) and the UI lane (the catalog widgets that render it). The
 * agent's "widget planner" turns each section into an A2UI surface using the
 * catalog component named in WIDGET_TO_COMPONENT below.
 *
 * Two layers:
 *   Layer 1 — `LecturePlan` (this file): the structured analysis of the lecture.
 *   Layer 2 — an A2UI surface: the planner composes catalog components from the
 *             plan; the frontend renders it via the existing surface pipeline.
 *             No new "plan renderer" is needed — only the catalog widgets.
 */

export type Subject =
  | "math"
  | "life_sciences"
  | "finance"
  | "theory"
  | "procedural";

/** The widget type the planner assigns to a section. v1 implements the math +
 *  shared set; other subjects extend this union as their widgets land. */
export type WidgetType =
  | "graph_explorer"
  | "concept_map"
  | "topic_card"
  | "quiz"
  | "flashcards"
  | "mastery"
  | "simulation"; // finance path (RateShockSimulator) — reusable second subject

export interface LectureSection {
  id: string;
  title: string;
  summary: string;
  widget: WidgetType;
  /** Shape depends on `widget` — matches the target component's props. */
  widgetProps: Record<string, unknown>;
}

export interface ConceptMapData {
  nodes: Array<{ id: string; label: string; level?: number; group?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

export interface LecturePlan {
  subject: Subject;
  title: string;
  /** 0..1 classifier confidence — UI may show a "looks like math" hint. */
  confidence?: number;
  sections: LectureSection[];
  conceptMap: ConceptMapData;
  takeaway: string;
}

/**
 * Widget → A2UI catalog component the planner should emit. Keep in sync with
 * src/a2ui/catalog/definitions.ts and agent/src/catalog.py (CATALOG_PROMPT).
 */
export const WIDGET_TO_COMPONENT: Record<WidgetType, string> = {
  graph_explorer: "GraphExplorer",
  concept_map: "ConceptMap",
  topic_card: "Card", // Card → Stack(Heading, Text, Badge)
  quiz: "QuizGame",
  flashcards: "Flashcard", // a Grid of Flashcards
  mastery: "ProgressTracker",
  simulation: "RateShockSimulator", // finance subject path
};

/** Default section→widget mapping for math/stats lectures (v1 demo vertical). */
export const MATH_SECTION_DEFAULTS: Record<string, WidgetType> = {
  functions: "graph_explorer",
  derivatives: "topic_card",
  optimization: "graph_explorer", // plot the objective, see the max/min
  utility: "simulation",
  risk: "simulation",
};
