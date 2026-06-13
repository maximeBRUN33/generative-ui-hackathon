/**
 * A2UI custom catalog. platform-agnostic component definitions.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CUSTOMIZATION SEAM #4 — Add an A2UI component
 * See HACKATHON.md §4 for the full recipe. The component dance:
 *   1. Add a definition here (one-line description + Zod props schema).
 *   2. Add the matching React renderer in renderers.tsx.
 *   3. Mirror a one-line prompt summary in agent/src/catalog.py's
 *      CATALOG_PROMPT so the agent knows the component exists.
 * Then run `pnpm validate-widget <path>` (for any JSON you touched) and
 * `pnpm smoke`.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * These are the components the agent is allowed to use. Each entry pairs a
 * Zod prop schema with a description. The same definitions are shipped to:
 *   - the frontend renderer (paired with React renderers in renderers.tsx)
 *   - the backend agent (the prompt builder reads the JSON-shape via extractSchema)
 *
 * Catalog ID is constant and shared with the Python tools so createSurface
 * resolves to the right component map on the client.
 */
import { z } from "zod";

export const CATALOG_ID = "https://cpk-a2ui.local/catalogs/copilotkit/v1";

/* `child` and `children` refer to component IDs (resolved at render time). */
const childRef = z.string();
const childrenRef = z.union([
  z.array(z.string()),
  z.object({ componentId: z.string(), path: z.string() }),
]);

/* Helpers for "may be a literal or a path binding". */
const stringOrPath = z.union([z.string(), z.object({ path: z.string() })]);
const numberOrPath = z.union([z.number(), z.object({ path: z.string() })]);

export const definitions = {
  Stack: {
    description:
      "Vertical layout. Children stack top→bottom with consistent gap. Use as the default page/section container.",
    props: z.object({
      children: childrenRef,
      gap: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
    }),
  },

  Row: {
    description:
      "Horizontal layout. Children sit side-by-side; wraps on small screens. Use for toolbars, metric rows, badge groups.",
    props: z.object({
      children: childrenRef,
      gap: z.enum(["xs", "sm", "md", "lg"]).optional(),
      justify: z.enum(["start", "center", "end", "spaceBetween"]).optional(),
      align: z.enum(["start", "center", "end"]).optional(),
    }),
  },

  Grid: {
    description:
      "Responsive grid. Children fill columns left→right. Use for stat-card rows, chart pairs, card galleries.",
    props: z.object({
      children: childrenRef,
      columns: z.number().int().min(1).max(6).optional(),
      gap: z.enum(["xs", "sm", "md", "lg"]).optional(),
    }),
  },

  Section: {
    description:
      "Titled section with optional eyebrow + actions row. Use to group dashboard regions (e.g. 'Revenue', 'Top customers').",
    props: z.object({
      title: z.string(),
      eyebrow: z.string().optional(),
      child: childRef,
    }),
  },

  Card: {
    description:
      "Bordered, rounded surface with padding. Pass a child layout (Stack/Row/Grid) as `child`.",
    props: z.object({
      child: childRef,
      tone: z.enum(["default", "lilac", "mint", "warning"]).optional(),
    }),
  },

  Divider: {
    description: "A 1px line. No props.",
    props: z.object({}),
  },

  Heading: {
    description:
      "Page or section title. Use level 1 once per surface; 2 for major sections; 3 for sub-blocks.",
    props: z.object({
      text: stringOrPath,
      level: z.enum(["1", "2", "3"]).optional(),
    }),
  },

  Text: {
    description:
      "Body copy. Use tone='muted' for secondary text. Use size='sm' for captions.",
    props: z.object({
      text: stringOrPath,
      tone: z.enum(["default", "muted"]).optional(),
      size: z.enum(["sm", "md", "lg"]).optional(),
      weight: z.enum(["regular", "medium", "semibold"]).optional(),
    }),
  },

  Overline: {
    description:
      "Tiny ALL-CAPS mono label that sits above a heading. Common typography pattern (Material Design calls this 'Overline'). Use for section categories like 'OVERVIEW · Q1 2025'.",
    props: z.object({ text: stringOrPath }),
  },

  Badge: {
    description:
      "Small inline status pill. Use tone to imply meaning (positive=green, warning=amber, neutral=lilac).",
    props: z.object({
      label: stringOrPath,
      tone: z
        .enum(["neutral", "positive", "warning", "danger", "info"])
        .optional(),
    }),
  },

  Callout: {
    description:
      "Block-level highlight for a key insight, definition, or warning. Use for 'the takeaway' moments inside an explanation. Tone picks the accent color (info=lilac, positive=green, warning=amber, neutral=grey).",
    props: z.object({
      body: stringOrPath,
      title: stringOrPath.optional(),
      tone: z.enum(["info", "positive", "warning", "neutral"]).optional(),
    }),
  },

  BulletList: {
    description:
      "Bulleted or numbered list. Use for short enumerations like 'three key contributions' or 'steps to reproduce'. Pass items as a literal string array or a {path} binding.",
    props: z.object({
      items: z.union([z.array(z.string()), z.object({ path: z.string() })]),
      ordered: z.boolean().optional(),
    }),
  },

  StatCard: {
    description:
      "Single big-number metric. Always include label + value. Use delta (e.g. '+12.4%') with deltaTone for trend.",
    props: z.object({
      label: stringOrPath,
      value: stringOrPath,
      delta: stringOrPath.optional(),
      deltaTone: z.enum(["positive", "negative", "neutral"]).optional(),
      caption: stringOrPath.optional(),
    }),
  },

  BarChart: {
    description:
      "Vertical bars. `data` must be an inline array of {label, value} objects (or a path that resolves to one). Use when labels are short (months, regions, < 7 chars). For long labels (customer names, country names), use HorizontalBarChart instead.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  HorizontalBarChart: {
    description:
      "Horizontal bars (rows). Same `data` shape as BarChart: [{label, value}]. Use for ranked lists where labels are long (e.g. 'Top 10 customers by ARR'). Height auto-sizes from row count.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(640).optional(),
    }),
  },

  LineChart: {
    description:
      "Time-series line. `data` is [{label, value}, ...]. Use for trends where you want the direction of change to be the main signal.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  DonutChart: {
    description:
      "Donut / segment chart. `data` is [{label, value}, ...]. Use for share-of-total breakdowns with 3-6 slices.",
    props: z.object({
      data: z.union([
        z.array(z.object({ label: z.string(), value: z.number() })),
        z.object({ path: z.string() }),
      ]),
      height: z.number().int().min(120).max(480).optional(),
    }),
  },

  ScatterChart: {
    description:
      "X/Y scatter plot for correlation questions. `data` is [{x: number, y: number, label?: string}]. Use when the user asks 'is X correlated with Y' or 'plot A against B'. Provide xLabel and yLabel so the user knows what each axis represents.",
    props: z.object({
      data: z.union([
        z.array(
          z.object({
            x: z.number(),
            y: z.number(),
            label: z.string().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
      xLabel: z.string().optional(),
      yLabel: z.string().optional(),
      height: z.number().int().min(160).max(560).optional(),
    }),
  },

  DataTable: {
    description:
      "Rows × columns table. `columns` is a list of {key, label}; `rows` is a list of records keyed by column key.",
    props: z.object({
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(["left", "right"]).optional(),
        }),
      ),
      rows: z.union([
        z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
        z.object({ path: z.string() }),
      ]),
    }),
  },

  Button: {
    description:
      "Action button. Variant 'primary' is the main CTA (dark). 'secondary' is outlined. 'ghost' is borderless.",
    props: z.object({
      label: stringOrPath,
      variant: z.enum(["primary", "secondary", "ghost"]).optional(),
      action: z.object({
        event: z.object({
          name: z.string(),
          context: z.record(z.string(), z.unknown()).optional(),
        }),
      }),
    }),
  },

  ChoiceChips: {
    description:
      "Horizontal pills bound to a data-model path. Use for scope filters " +
      "and quick switches. `options` is path-bindable so the agent can " +
      "populate the chips dynamically from data it just extracted.",
    props: z.object({
      label: z.string(),
      options: z.union([
        z.array(z.object({ label: z.string(), value: z.string() })),
        z.object({ path: z.string() }),
      ]),
      value: z.object({ path: z.string() }),
      multi: z.boolean().optional(),
    }),
  },

  // ── Study components (Copilearn) ────────────────────────────────────────
  // Added for the generative learning workspace. Flashcard + QuizQuestion are
  // interactive via LOCAL React state (flip / answer feedback) — no agent
  // round-trip, so the demo stays instant. ProgressTracker is a data-bound
  // display, path-bindable like the charts.
  Flashcard: {
    description:
      "A flip card for study. Shows `front` (the term/prompt); click to flip " +
      "and reveal `back` (the definition/answer). Optional `hint` shows under " +
      "the front. Use a Stack/Grid of Flashcards for a deck.",
    props: z.object({
      front: stringOrPath,
      back: stringOrPath,
      hint: stringOrPath.optional(),
      emoji: stringOrPath.optional(),
    }),
  },

  QuizQuestion: {
    description:
      "A single multiple-choice practice question with instant feedback. " +
      "`options` is the answer list; `correctIndex` is the 0-based index of " +
      "the correct option; `explanation` is revealed after answering. Use a " +
      "Stack of QuizQuestions for a quiz.",
    props: z.object({
      question: stringOrPath,
      options: z.array(z.string()),
      correctIndex: z.number().int().min(0),
      explanation: stringOrPath.optional(),
    }),
  },

  ProgressTracker: {
    description:
      "Mastery bars, one per concept. `items` is a list of {label, value} " +
      "where value is 0-100 percent mastered. Optional per-item tone. " +
      "Path-bindable: bind `items` to a data-model array.",
    props: z.object({
      items: z.union([
        z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            tone: z.enum(["default", "positive", "warning"]).optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
    }),
  },

  RateShockSimulator: {
    description:
      "Interactive bond interest-rate-risk simulator. The student drags a " +
      "yield-change slider and sees the bond's actual repriced value vs the " +
      "duration-only (linear) estimate and the duration+convexity estimate — " +
      "teaching why duration under-predicts for large rate moves. All bond " +
      "math is computed in the renderer from the params below.",
    props: z.object({
      title: stringOrPath.optional(),
      faceValue: numberOrPath, // e.g. 1000
      couponRate: numberOrPath, // annual coupon %, e.g. 9
      maturityYears: numberOrPath, // e.g. 5
      ytm: numberOrPath, // annual yield-to-maturity %, e.g. 9
      frequency: numberOrPath.optional(), // coupons per year, default 2
    }),
  },

  QuizGame: {
    description:
      "A scored, gamified quiz. Presents questions one at a time with points, " +
      "a streak multiplier, and a final score screen. Use this (not a Stack of " +
      "QuizQuestions) when the user wants to 'play', 'be tested', or compete. " +
      "`questions` is path-bindable.",
    props: z.object({
      title: stringOrPath.optional(),
      questions: z.union([
        z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()),
            correctIndex: z.number().int().min(0),
            explanation: z.string().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
    }),
  },

  // ── Open generative UI escape hatch ─────────────────────────────────────
  // The one component that is NOT a fixed shape: the agent authors raw
  // HTML/SVG/CSS and it renders in a sandboxed iframe. This is how Copilearn
  // does "open" generative UI without giving up the safety of the catalog for
  // everything else.
  FreeformUI: {
    description:
      "Open, agent-authored UI. The agent writes raw, self-contained " +
      "HTML/CSS/SVG (plus optional inline <script>) and it renders in a " +
      "SANDBOXED iframe with the app's theme tokens available as CSS " +
      "variables. Use ONLY when no other catalog component fits — a bespoke " +
      "diagram, a custom animation, a one-off interactive. No external URLs " +
      "or network calls (blocked). To send an action back to the agent the " +
      "HTML calls window.a2uiAction(name, context).",
    props: z.object({
      html: z.string(),
      height: z.number().optional(),
      title: stringOrPath.optional(),
    }),
  },

  // ── Math widgets (content-adaptive, v2) ─────────────────────────────────
  GraphExplorer: {
    description:
      "Interactive function plotter for math lectures. Supply a math " +
      "`expression` in x (with optional named params); the student drags " +
      "parameter sliders and the curve updates live. Use for 'functions' / " +
      "'optimization' sections. Expressions support + - * / ^, parentheses, " +
      "unary minus, functions sin/cos/tan/exp/ln/log/sqrt/abs, constants " +
      "pi/e, the variable x, and any named params (e.g. 'a*x^2 + b*x + c').",
    props: z.object({
      title: stringOrPath.optional(),
      expression: stringOrPath,
      params: z.union([
        z.array(
          z.object({
            name: z.string(),
            min: z.number(),
            max: z.number(),
            value: z.number(),
            step: z.number().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]).optional(),
      xRange: z.union([z.array(z.number()), z.object({ path: z.string() })]).optional(),
      yRange: z.union([z.array(z.number()), z.object({ path: z.string() })]).optional(),
      xLabel: stringOrPath.optional(),
      yLabel: stringOrPath.optional(),
    }),
  },

  SimulationLab: {
    description:
      "An interactive 16-bit physics 'lab': the student tunes sliders " +
      "(angle, power, gravity), hits FIRE, and tries to land a projectile on " +
      "a target — with a live predicted-arc trace and a hit/miss verdict. Use " +
      "for motion / physics / projectile / 'tune-to-hit-the-goal' topics — the " +
      "playable, hands-on simulation for a course.",
    props: z.object({
      title: stringOrPath.optional(),
      subject: stringOrPath.optional(),
      gravity: numberOrPath.optional(),
    }),
  },

  ConceptMap: {
    description:
      "A node-and-edge map of how a lecture's concepts relate — the study " +
      "overview. Give each node a `level` (0 = earliest) for a clean " +
      "left-to-right layout. Clicking a node fires a 'focus_topic' action so " +
      "the agent can zoom into that concept. `nodes`/`edges` are path-bindable.",
    props: z.object({
      title: stringOrPath.optional(),
      nodes: z.union([
        z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            level: z.number().optional(),
            group: z.string().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
      edges: z.union([
        z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            label: z.string().optional(),
          }),
        ),
        z.object({ path: z.string() }),
      ]),
    }),
  },
};

export type Definitions = typeof definitions;
