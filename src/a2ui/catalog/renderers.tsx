"use client";

import { clsx } from "clsx";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RendererProps } from "@copilotkit/a2ui-renderer";

/* The runtime walks `{path}` bindings against the data model before
 * handing props to renderers, so every prop value below is post-resolution. */

const GAP = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-10",
};
const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
};
const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

/* CopilotKit brand-accent palette in fixed legend order. */
const CHART_PALETTE = ["#7c70f5", "#3aa37f", "#e89232", "#d5b62c", "#d54b53"];

const fmtNumber = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : n.toLocaleString();

/* A delta value is "meaningful" if it has a digit. Bare "+" / "-" or empty
 * strings shouldn't render a badge; that just produces an empty pill. */
const hasMeaningfulDelta = (v?: string) =>
  typeof v === "string" && /\d/.test(v);

/* Reduce verbose delta strings to the badge's job: just the magnitude.
 * Agents sometimes dump comparison prose like "vs. $89,498M in Q4 FY23"
 * into delta when asked about quarterly comparisons. The badge can't hold
 * that without breaking the card layout, so we extract the first signed
 * number/percent token and let the surrounding context (StatCard caption,
 * table cell) carry the comparison text instead. */
const condenseDelta = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.length <= 8) return trimmed;
  const patterns = [
    /[+-]\s*\d+(?:[.,]\d+)?\s*%/,
    /\d+(?:[.,]\d+)?\s*%/,
    /[+-]\s*\$?\d+(?:[.,]\d+)?\s*[KMB]?/i,
    /\$?\d+(?:[.,]\d+)?\s*[KMB]?/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[0].replace(/\s+/g, "");
  }
  return trimmed;
};

/* Pull the first number from a free-form string. Handles $X, X.XM, etc.
 * Returns the number's magnitude (sign + numeric value), preserving the
 * order-of-magnitude suffix (k/M/B) when present. */
const parseMoneyish = (s: string): number | null => {
  if (typeof s !== "string") return null;
  const m = s.replace(/[,_]/g, "").match(/(-?\d+(?:\.\d+)?)\s*([kKmMbB]?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const suffix = (m[2] || "").toLowerCase();
  const mult =
    suffix === "k"
      ? 1_000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
          ? 1_000_000_000
          : 1;
  return n * mult;
};

/* When the agent leaves `delta` empty but caption carries a prior-period
 * value like "vs. $89,498M in Q4 FY23", compute the percentage from
 * value vs. that prior number so the user still sees the badge they
 * asked for. Returns a string like "+6.1%" / "-3.0%" or null when we
 * can't extract two comparable numbers. Loose by design: this is a
 * fallback for noisy prompts; the agent should provide its own delta. */
const autoDelta = (value?: string, caption?: string): string | null => {
  if (!value || !caption) return null;
  // Caption needs to look like a comparison. Anchor on "vs.", "from",
  // "compared", "prior", or a leading "$" right after the verb.
  if (!/vs\.|from|compared|prior|previous|last|relative to/i.test(caption)) {
    return null;
  }
  const current = parseMoneyish(value);
  const prior = parseMoneyish(caption);
  if (current == null || prior == null || prior === 0) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  if (!isFinite(pct)) return null;
  const sign = pct >= 0 ? "+" : "";
  // 1 decimal for sub-10% movements, integer otherwise: easier to scan.
  return `${sign}${Math.abs(pct) < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
};

const Stack = ({
  props,
  children,
}: RendererProps<{
  children: string[] | { componentId: string; path: string };
  gap?: keyof typeof GAP;
  align?: keyof typeof ALIGN;
}>) => (
  <div
    className={clsx(
      "flex flex-col",
      GAP[props.gap ?? "md"],
      props.align && ALIGN[props.align],
    )}
  >
    {Array.isArray(props.children)
      ? props.children.map((id) => <Slot key={id} render={children(id)} />)
      : null}
  </div>
);

const Row = ({
  props,
  children,
}: RendererProps<{
  children: string[];
  gap?: keyof typeof GAP;
  justify?: keyof typeof JUSTIFY;
  align?: keyof typeof ALIGN;
}>) => (
  <div
    className={clsx(
      "flex flex-wrap",
      GAP[props.gap ?? "sm"],
      props.justify && JUSTIFY[props.justify],
      ALIGN[props.align ?? "center"],
    )}
  >
    {Array.isArray(props.children)
      ? props.children.map((id) => <Slot key={id} render={children(id)} />)
      : null}
  </div>
);

const Grid = ({
  props,
  children,
}: RendererProps<{
  children: string[];
  columns?: number;
  gap?: keyof typeof GAP;
}>) => {
  const cols = props.columns ?? 3;
  const colMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-5",
    6: "grid-cols-2 lg:grid-cols-6",
  };
  return (
    <div className={clsx("grid", colMap[cols], GAP[props.gap ?? "md"])}>
      {Array.isArray(props.children)
        ? props.children.map((id) => <Slot key={id} render={children(id)} />)
        : null}
    </div>
  );
};

const Section = ({
  props,
  children,
}: RendererProps<{ title: string; eyebrow?: string; child: string }>) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      {props.eyebrow && (
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
          {props.eyebrow}
        </span>
      )}
      <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">
        {props.title}
      </h2>
    </div>
    {children(props.child)}
  </section>
);

const Card = ({
  props,
  children,
}: RendererProps<{
  child: string;
  tone?: "default" | "lilac" | "mint" | "warning";
}>) => {
  const tones: Record<string, string> = {
    default: "bg-[var(--surface)] border-[var(--line)]",
    lilac:
      "bg-[color-mix(in_oklab,var(--lilac)_8%,white)] border-[var(--lilac)]",
    mint: "bg-[color-mix(in_oklab,var(--mint)_10%,white)] border-[color-mix(in_oklab,var(--mint)_60%,white)]",
    warning:
      "bg-[color-mix(in_oklab,var(--orange)_8%,white)] border-[color-mix(in_oklab,var(--orange)_50%,white)]",
  };
  return (
    <div
      className={clsx(
        "rounded-[var(--radius)] border p-5",
        tones[props.tone ?? "default"],
      )}
    >
      {children(props.child)}
    </div>
  );
};

const Divider = () => <hr className="border-0 border-t border-[var(--line)]" />;

const Heading = ({
  props,
}: RendererProps<{ text: string; level?: "1" | "2" | "3" }>) => {
  const level = props.level ?? "2";
  const Tag = level === "1" ? "h1" : level === "3" ? "h3" : "h2";
  const sizes = {
    "1": "text-[30px] font-semibold tracking-tight leading-[1.1]",
    "2": "text-[20px] font-semibold tracking-tight leading-[1.2]",
    "3": "text-[15px] font-semibold leading-tight",
  } as const;
  return (
    <Tag className={clsx(sizes[level], "text-[var(--ink)]")}>{props.text}</Tag>
  );
};

const Text = ({
  props,
}: RendererProps<{
  text: string;
  tone?: "default" | "muted";
  size?: "sm" | "md" | "lg";
  weight?: "regular" | "medium" | "semibold";
}>) => (
  <p
    className={clsx(
      props.size === "sm"
        ? "text-[13px]"
        : props.size === "lg"
          ? "text-[16px]"
          : "text-[14px]",
      props.tone === "muted" ? "text-[var(--ink)]" : "text-[var(--ink-2)]",
      props.weight === "medium"
        ? "font-medium"
        : props.weight === "semibold"
          ? "font-semibold"
          : "font-normal",
      "leading-relaxed",
    )}
  >
    {props.text}
  </p>
);

const Overline = ({ props }: RendererProps<{ text: string }>) => (
  <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
    {props.text}
  </span>
);

const Badge = ({
  props,
}: RendererProps<{
  label: string;
  tone?: "neutral" | "positive" | "warning" | "danger" | "info";
}>) => {
  const tones = {
    neutral:
      "bg-[var(--surface-soft)] text-[var(--ink-2)] border-[var(--line)]",
    info: "bg-[color-mix(in_oklab,var(--lilac)_18%,white)] text-[#2e2c75] border-[color-mix(in_oklab,var(--lilac)_60%,white)]",
    positive:
      "bg-[color-mix(in_oklab,var(--mint)_18%,white)] text-[#0a5d44] border-[color-mix(in_oklab,var(--mint)_70%,white)]",
    warning:
      "bg-[color-mix(in_oklab,var(--orange)_18%,white)] text-[#7a3f0f] border-[color-mix(in_oklab,var(--orange)_60%,white)]",
    danger:
      "bg-[color-mix(in_oklab,var(--red)_12%,white)] text-[#7a1b22] border-[color-mix(in_oklab,var(--red)_55%,white)]",
  } as const;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] mono uppercase tracking-wider font-medium",
        tones[props.tone ?? "neutral"],
      )}
    >
      {props.label}
    </span>
  );
};

const Callout = ({
  props,
}: RendererProps<{
  body: string;
  title?: string;
  tone?: "info" | "positive" | "warning" | "neutral";
}>) => {
  const tone = props.tone ?? "info";
  const accents: Record<
    typeof tone,
    { bar: string; bg: string; chip: string }
  > = {
    info: {
      bar: "bg-[var(--lilac)]",
      bg: "bg-[color-mix(in_oklab,var(--lilac)_7%,var(--surface))]",
      chip: "text-[#2e2c75]",
    },
    positive: {
      bar: "bg-[var(--mint)]",
      bg: "bg-[color-mix(in_oklab,var(--mint)_8%,var(--surface))]",
      chip: "text-[#0a5d44]",
    },
    warning: {
      bar: "bg-[var(--orange)]",
      bg: "bg-[color-mix(in_oklab,var(--orange)_8%,var(--surface))]",
      chip: "text-[#7a3f0f]",
    },
    neutral: {
      bar: "bg-[var(--ink-2)]",
      bg: "bg-[var(--surface-soft)]",
      chip: "text-[var(--ink)]",
    },
  };
  const a = accents[tone];
  return (
    <div
      className={clsx(
        "relative rounded-[var(--radius)] border border-[var(--line)] pl-4 pr-5 py-4 flex flex-col gap-1.5 overflow-hidden",
        a.bg,
      )}
    >
      <span
        aria-hidden
        className={clsx("absolute left-0 top-0 bottom-0 w-1", a.bar)}
      />
      {props.title && (
        <span
          className={clsx(
            "mono text-[10.5px] uppercase tracking-[0.14em] font-medium",
            a.chip,
          )}
        >
          {props.title}
        </span>
      )}
      <span className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        {props.body}
      </span>
    </div>
  );
};

const BulletList = ({
  props,
}: RendererProps<{
  items: string[];
  ordered?: boolean;
}>) => {
  const items = Array.isArray(props.items) ? props.items : [];
  if (!items.length) return null;
  const Tag = props.ordered ? "ol" : "ul";
  // We render markers manually inside each <li>. `display: flex` on the
  // li (which we want for clean alignment) kills the browser's native
  // `list-decimal` / `list-disc` rendering, so for ordered lists we
  // synthesize the "1." / "2." prefix ourselves.
  return (
    <Tag className="flex flex-col gap-2 text-[14px] text-[var(--ink-2)] leading-relaxed list-none pl-0 m-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          {props.ordered ? (
            <span
              aria-hidden
              className="mono tabular-nums text-[12px] text-[var(--ink)] font-medium leading-relaxed min-w-[1.25rem] flex-none"
            >
              {i + 1}.
            </span>
          ) : (
            <span
              aria-hidden
              className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--lilac)] flex-none"
            />
          )}
          <span className="flex-1 min-w-0">{it}</span>
        </li>
      ))}
    </Tag>
  );
};

const StatCard = ({
  props,
}: RendererProps<{
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  caption?: string;
}>) => {
  // Prefer the agent's delta. Fall back to auto-computing from value vs.
  // the prior number in caption when the agent left delta blank.
  const explicitDelta = hasMeaningfulDelta(props.delta)
    ? condenseDelta(props.delta!)
    : null;
  const computedDelta = explicitDelta
    ? null
    : autoDelta(props.value, props.caption);
  const finalDelta = explicitDelta ?? computedDelta;

  // Derive tone from the sign of the computed delta when the agent
  // didn't set deltaTone (or set it incorrectly relative to the actual
  // movement). For explicit deltas, trust the agent's tone choice.
  const inferredTone: "positive" | "negative" | "neutral" =
    computedDelta?.startsWith("-")
      ? "negative"
      : computedDelta?.startsWith("+")
        ? "positive"
        : (props.deltaTone ?? "neutral");
  const effectiveTone = explicitDelta
    ? (props.deltaTone ?? "neutral")
    : inferredTone;

  const deltaClass =
    effectiveTone === "positive"
      ? "text-[#0a5d44] bg-[color-mix(in_oklab,var(--mint)_22%,white)] border-[color-mix(in_oklab,var(--mint)_60%,white)]"
      : effectiveTone === "negative"
        ? "text-[#7a1b22] bg-[color-mix(in_oklab,var(--red)_15%,white)] border-[color-mix(in_oklab,var(--red)_45%,white)]"
        : "text-[var(--ink-2)] bg-[var(--surface-soft)] border-[var(--line)]";

  const arrow =
    effectiveTone === "positive"
      ? "↑"
      : effectiveTone === "negative"
        ? "↓"
        : "→";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-2.5">
      <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
        {props.label}
      </span>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[28px] font-semibold tracking-tight text-[var(--ink)] leading-none tabular-nums">
          {props.value}
        </span>
        {finalDelta && (
          <span
            className={clsx(
              "mono text-[11px] px-1.5 py-0.5 rounded-md border font-medium tabular-nums inline-flex items-center gap-1",
              deltaClass,
            )}
          >
            <span aria-hidden>{arrow}</span>
            {finalDelta}
          </span>
        )}
      </div>
      {props.caption && (
        <span className="text-[12px] text-[var(--ink)] leading-snug">
          {props.caption}
        </span>
      )}
    </div>
  );
};

type Series = { label: string; value: number }[];

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  color: "var(--ink)",
  boxShadow: "0 4px 12px -2px rgba(10, 10, 15, 0.08)",
};

/* Per-item text inside the tooltip. Recharts otherwise inherits the
 * series fill color (light lilac for our charts), which renders as
 * washed-out text. Force a saturated dark purple so the numbers stay
 * readable and on-brand. */
const tooltipItemStyle = {
  color: "#3b3a8a",
  fontSize: 12,
  fontWeight: 500,
};
const tooltipLabelStyle = {
  color: "var(--ink)",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 2,
};

const axisTickStyle = {
  fontSize: 11,
  fill: "var(--ink)",
  fontWeight: 500,
};

/* If long or many x-axis labels would collide, rotate them and let
 * recharts auto-skip overlapping ones. The threshold is conservative:
 * any label over 6 chars OR more than 6 data points → angle. */
function xAxisProps(data: Series) {
  const maxLen = data.reduce((m, d) => Math.max(m, (d.label ?? "").length), 0);
  const tilt = maxLen > 6 || data.length > 6;
  return {
    angle: tilt ? -28 : 0,
    height: tilt ? 56 : 24,
    textAnchor: tilt ? ("end" as const) : ("middle" as const),
    interval: "preserveStartEnd" as const,
    minTickGap: 8,
    dy: tilt ? 4 : 0,
  };
}

const BarChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const xa = xAxisProps(data);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ResponsiveContainer>
        <RBarChart
          data={data}
          margin={{ top: 24, right: 12, left: 4, bottom: xa.angle ? 16 : 4 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            angle={xa.angle}
            height={xa.height}
            textAnchor={xa.textAnchor}
            interval={xa.interval}
            minTickGap={xa.minTickGap}
            dy={xa.dy}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={fmtNumber}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ fill: "var(--lilac-softer)" }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--lilac)">
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
};

const LineChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const xa = xAxisProps(data);
  return (
    <div style={{ width: "100%", height: props.height ?? 240 }}>
      <ResponsiveContainer>
        <RLineChart
          data={data}
          margin={{ top: 24, right: 16, left: 4, bottom: xa.angle ? 16 : 4 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            vertical={false}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            angle={xa.angle}
            height={xa.height}
            textAnchor={xa.textAnchor}
            interval={xa.interval}
            minTickGap={xa.minTickGap}
            dy={xa.dy}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={fmtNumber}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b3a8a"
            strokeWidth={2.5}
            dot={{
              r: 3.5,
              fill: "var(--lilac)",
              stroke: "#3b3a8a",
              strokeWidth: 1.5,
            }}
            activeDot={{ r: 5 }}
          >
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Line>
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
};

const HorizontalBarChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  // Auto-size: ~32px per row + padding. Caller can override via height.
  const height = props.height ?? Math.max(180, data.length * 32 + 48);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RBarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 56, left: 4, bottom: 8 }}
        >
          <CartesianGrid
            stroke="var(--line-2)"
            horizontal={false}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtNumber}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ fill: "var(--lilac-softer)" }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="var(--lilac)">
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
              formatter={(v: unknown) => fmtNumber(Number(v))}
            />
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
};

type ScatterPoint = { x: number; y: number; label?: string };

const ScatterChart = ({
  props,
}: RendererProps<{
  data: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}>) => {
  const data = props.data ?? [];
  return (
    <div style={{ width: "100%", height: props.height ?? 280 }}>
      <ResponsiveContainer>
        <RScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={props.xLabel ?? "x"}
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtNumber}
            label={
              props.xLabel
                ? {
                    value: props.xLabel,
                    position: "insideBottom",
                    offset: -8,
                    style: { fontSize: 11, fill: "var(--ink)" },
                  }
                : undefined
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            name={props.yLabel ?? "y"}
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={fmtNumber}
            label={
              props.yLabel
                ? {
                    value: props.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--ink)" },
                  }
                : undefined
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(v: unknown, name: unknown) => [
              fmtNumber(Number(v)),
              name == null ? "" : String(name),
            ]}
          />
          <Scatter
            data={data}
            fill="var(--lilac)"
            stroke="#3b3a8a"
            strokeWidth={1.5}
          />
        </RScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

const DonutChart = ({
  props,
}: RendererProps<{ data: Series; height?: number }>) => {
  const data = props.data ?? [];
  const total = data.reduce((s, d) => s + d.value, 0);
  const height = props.height ?? 240;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(value: unknown, name: unknown) => [
                fmtNumber(Number(value)),
                String(name),
              ]}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Total in the middle of the donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink)]">
            Total
          </span>
          <span className="text-[20px] font-semibold tracking-tight text-[var(--ink)] tabular-nums leading-tight">
            {fmtNumber(total)}
          </span>
        </div>
      </div>

      {/* External legend with values */}
      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={`${d.label}-${i}`}
              className="flex items-center gap-3 text-[13px]"
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
              />
              <span className="text-[var(--ink-2)] truncate flex-1 min-w-0">
                {d.label}
              </span>
              <span className="mono tabular-nums text-[12.5px] text-[var(--ink)] font-medium shrink-0">
                {fmtNumber(d.value)}
              </span>
              <span className="mono text-[11px] text-[var(--ink)] shrink-0 w-9 text-right">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const DataTable = ({
  props,
}: RendererProps<{
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
}>) => {
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full text-[13.5px] border-collapse">
        <thead className="bg-[var(--surface-soft)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx(
                  "px-4 py-2.5 font-medium mono uppercase tracking-[0.1em] text-[10.5px] text-[var(--ink)] border-b border-[var(--line)]",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={clsx(
                "border-b border-[var(--line-2)] last:border-b-0 transition-colors hover:bg-[var(--surface-soft)]",
              )}
            >
              {columns.map((c) => {
                const raw = row[c.key];
                const text = raw == null ? "" : String(raw);
                const looksLikeDelta = c.key === "delta" || c.key === "Δ";
                const meaningful = !looksLikeDelta || hasMeaningfulDelta(text);
                if (looksLikeDelta && meaningful) {
                  const tone = text.trim().startsWith("-")
                    ? "text-[#7a1b22]"
                    : text.trim().startsWith("+")
                      ? "text-[#0a5d44]"
                      : "text-[var(--ink-2)]";
                  return (
                    <td
                      key={c.key}
                      className={clsx(
                        "px-4 py-3 tabular-nums mono text-[12px] font-medium",
                        c.align === "right" ? "text-right" : "text-left",
                        tone,
                      )}
                    >
                      {text}
                    </td>
                  );
                }
                return (
                  <td
                    key={c.key}
                    className={clsx(
                      "px-4 py-3 text-[var(--ink-2)]",
                      c.align === "right"
                        ? "text-right tabular-nums mono text-[13px]"
                        : "text-left",
                    )}
                  >
                    {meaningful ? (
                      (text as ReactNode)
                    ) : (
                      <span className="text-[var(--ink)]">. </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Button = ({
  props,
  dispatch,
}: RendererProps<{
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  action: { event: { name: string; context?: Record<string, unknown> } };
}>) => {
  const variants = {
    primary: "bg-[var(--ink)] text-white hover:bg-[#1d1d23]",
    secondary:
      "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-soft)]",
    ghost: "text-[var(--ink)] hover:text-[var(--ink)]",
  };
  return (
    <button
      type="button"
      onClick={() =>
        dispatch?.({ ...props.action, sourceComponentId: undefined } as never)
      }
      className={clsx(
        "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] mono text-[12.5px] font-medium transition",
        variants[props.variant ?? "secondary"],
      )}
    >
      {props.label}
    </button>
  );
};

const ChoiceChips = ({
  props,
  dispatch,
}: RendererProps<{
  label: string;
  options: { label: string; value: string }[];
  value: string | string[];
  multi?: boolean;
}>) => {
  const selected = Array.isArray(props.value)
    ? props.value
    : props.value
      ? [props.value]
      : [];
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink)] font-medium">
        {props.label}
      </span>
      <div className="flex flex-wrap gap-2">
        {(props.options ?? []).map((o) => {
          const isOn = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                dispatch?.({
                  event: {
                    name: "select_chip",
                    context: { value: o.value, label: props.label },
                  },
                } as never)
              }
              className={clsx(
                "px-3 py-1.5 rounded-full text-[12px] border transition mono",
                isOn
                  ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                  : "bg-[var(--surface)] text-[var(--ink-2)] border-[var(--line)] hover:border-[var(--ink-2)]",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Study components (Copilearn) ──────────────────────────────────────────
// Flashcard and QuizQuestion keep their interactivity in LOCAL React state so
// the UI responds instantly without a round-trip to the agent. We only use the
// AG-UI `dispatch` channel when the *agent* genuinely needs to react.

const Flashcard = ({
  props,
}: RendererProps<{ front: string; back: string; hint?: string; emoji?: string }>) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="group relative w-full min-h-[170px] text-center flex flex-col items-center justify-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:border-[var(--ink-2)]"
    >
      {props.emoji && (
        <span className="text-[40px] leading-none" aria-hidden>
          {props.emoji}
        </span>
      )}
      {flipped ? (
        <p className="text-[16px] leading-snug text-[var(--ink)]">
          {props.back}
        </p>
      ) : (
        <p className="text-[18px] font-semibold leading-snug text-[var(--ink)]">
          {props.front}
        </p>
      )}
      <span className="mt-1 mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)]">
        {flipped ? "↻ tap to flip back" : "tap to learn ↦"}
      </span>
    </button>
  );
};

const QuizQuestion = ({
  props,
  dispatch,
}: RendererProps<{
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}>) => {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const isCorrect = picked === props.correctIndex;

  const choose = (i: number) => {
    if (answered) return; // lock after first answer
    setPicked(i);
    // Optional: tell the agent so it *could* bump mastery. Feedback above is
    // already shown client-side, so the demo never waits on this.
    dispatch?.({
      event: {
        name: "quiz_answered",
        context: { correct: i === props.correctIndex },
      },
    } as never);
  };

  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-[15px] font-semibold leading-snug text-[var(--ink)]">
        {props.question}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {props.options.map((opt, i) => {
          const correct = i === props.correctIndex;
          // After answering: green for the right option, red for a wrong pick.
          const state = !answered
            ? "idle"
            : correct
              ? "correct"
              : i === picked
                ? "wrong"
                : "muted";
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={clsx(
                "text-left text-[13.5px] px-3.5 py-2.5 rounded-[10px] border transition",
                state === "idle" &&
                  "border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink-2)] cursor-pointer",
                state === "correct" &&
                  "border-[var(--mint)] bg-[color-mix(in_oklab,var(--mint)_14%,var(--surface))] text-[#0a5d44] font-medium",
                state === "wrong" &&
                  "border-[#e0b4b4] bg-[color-mix(in_oklab,#d66_12%,var(--surface))] text-[#8a2c2c] font-medium",
                state === "muted" &&
                  "border-[var(--line)] text-[var(--ink-2)] opacity-70",
              )}
            >
              {opt}
              {state === "correct" && <span className="ml-2">✓</span>}
              {state === "wrong" && <span className="ml-2">✗</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3 text-[13px] leading-snug">
          <span
            className={clsx(
              "font-semibold",
              isCorrect ? "text-[#0a5d44]" : "text-[#8a2c2c]",
            )}
          >
            {isCorrect ? "Correct. " : "Not quite. "}
          </span>
          {props.explanation && (
            <span className="text-[var(--ink-2)]">{props.explanation}</span>
          )}
        </div>
      )}
    </div>
  );
};

type ProgressItem = {
  label: string;
  value: number;
  tone?: "default" | "positive" | "warning";
};

const ProgressTracker = ({
  props,
}: RendererProps<{ items: ProgressItem[] }>) => {
  const items = Array.isArray(props.items) ? props.items : [];
  const barColor = (tone: ProgressItem["tone"]) =>
    tone === "positive"
      ? "bg-[var(--mint)]"
      : tone === "warning"
        ? "bg-[var(--orange,#e8a33d)]"
        : "bg-[var(--lilac)]";
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const pct = Math.max(0, Math.min(100, Number(it.value) || 0));
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--ink)]">{it.label}</span>
              <span className="mono text-[11px] text-[var(--ink-2)]">
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--surface-soft,#eee)] overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-700", barColor(it.tone))}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── RateShockSimulator (Copilearn signature widget, Lecture 7) ─────────────
// Teaches interest-rate risk: move the yield slider and compare the bond's
// ACTUAL repriced value against the duration-only (linear) estimate and the
// duration+convexity estimate. All bond math is computed here from the params
// so the agent only has to supply the bond, not the calculus.

// Price a bond from periodic cashflows. Coupon every period; face added at n.
function priceBond(
  face: number,
  couponPerPeriod: number,
  yPeriod: number,
  n: number,
): number {
  let pv = 0;
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? couponPerPeriod + face : couponPerPeriod;
    pv += cf / Math.pow(1 + yPeriod, t);
  }
  return pv;
}

const RateShockSimulator = ({
  props,
}: RendererProps<{
  title?: string;
  faceValue: number;
  couponRate: number;
  maturityYears: number;
  ytm: number;
  frequency?: number;
}>) => {
  const face = Number(props.faceValue) || 1000;
  const couponRate = Number(props.couponRate) || 0;
  const maturityYears = Number(props.maturityYears) || 1;
  const ytm = Number(props.ytm) || 0;
  const freq = Number(props.frequency) || 2;

  // Δy in basis points (annual), controlled by the slider.
  const [bps, setBps] = useState(0);

  const n = Math.max(1, Math.round(maturityYears * freq));
  const c = (face * (couponRate / 100)) / freq; // periodic coupon
  const y = ytm / 100 / freq; // periodic yield

  const price = priceBond(face, c, y, n);

  // Macaulay duration (periods) and convexity (periods²) — slide-11/18 formulas.
  let macP = 0;
  let convP = 0;
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? c + face : c;
    const pv = cf / Math.pow(1 + y, t);
    macP += t * pv;
    convP += (t * t + t) * pv;
  }
  macP /= price;
  convP /= price * Math.pow(1 + y, 2);

  const macYears = macP / freq;
  const modDurYears = macYears / (1 + y); // modified duration in years
  const convYears = convP / (freq * freq); // convexity in years²

  const dy = bps / 10000; // annual Δy as a decimal
  const yNew = ytm / 100 + dy;
  const priceNew = priceBond(face, c, yNew / freq, n);

  const actualPct = (priceNew - price) / price; // true % change
  const linPct = -modDurYears * dy; // duration-only estimate
  const convPct = -modDurYears * dy + 0.5 * convYears * dy * dy; // + convexity

  const fmtPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;
  const fmtMoney = (x: number) =>
    `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const errLin = Math.abs(linPct - actualPct) * 100;

  const Stat = ({ k, v }: { k: string; v: string }) => (
    <div className="flex flex-col">
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-2)]">
        {k}
      </span>
      <span className="text-[15px] font-semibold text-[var(--ink)]">{v}</span>
    </div>
  );

  const Est = ({
    label,
    pct,
    tone,
    note,
  }: {
    label: string;
    pct: number;
    tone: "actual" | "lin" | "conv";
    note?: string;
  }) => (
    <div className="flex items-center justify-between rounded-[10px] border border-[var(--line)] px-3.5 py-2.5">
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-[var(--ink)]">
          {label}
        </span>
        {note && (
          <span className="text-[11px] text-[var(--ink-2)]">{note}</span>
        )}
      </div>
      <span
        className={clsx(
          "mono text-[15px] font-semibold",
          tone === "actual" && "text-[var(--ink)]",
          tone === "lin" && "text-[#8a2c2c]",
          tone === "conv" && "text-[#0a5d44]",
        )}
      >
        {fmtPct(pct)}
      </span>
    </div>
  );

  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {props.title || "Rate-Shock Simulator"}
        </span>
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-2)]">
          interest rate risk
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          k="Bond"
          v={`${couponRate}% · ${maturityYears}y`}
        />
        <Stat k="Price @ YTM" v={fmtMoney(price)} />
        <Stat k="Mod. duration" v={`${modDurYears.toFixed(2)} yrs`} />
        <Stat k="Convexity" v={convYears.toFixed(1)} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-2)]">
            Yield change
          </span>
          <span className="mono text-[13px] font-semibold text-[var(--ink)]">
            {bps >= 0 ? "+" : ""}
            {bps} bps → YTM {(ytm + bps / 100).toFixed(2)}%
          </span>
        </div>
        <input
          type="range"
          min={-400}
          max={400}
          step={25}
          value={bps}
          onChange={(e) => setBps(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--ink)]"
        />
        <div className="flex justify-between mono text-[10px] text-[var(--ink-2)]">
          <span>-400</span>
          <span>0</span>
          <span>+400</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Est
          label="Actual repriced value"
          pct={actualPct}
          tone="actual"
          note={`New price ${fmtMoney(priceNew)}`}
        />
        <Est
          label="Duration estimate (linear)"
          pct={linPct}
          tone="lin"
          note={`Off by ${errLin.toFixed(2)} pp`}
        />
        <Est
          label="Duration + convexity"
          pct={convPct}
          tone="conv"
          note="Adds the curvature correction"
        />
      </div>

      <p className="mt-3 text-[12px] leading-snug text-[var(--ink-2)]">
        Duration alone is a straight-line guess. The bigger the rate move, the
        more it under-predicts the price — convexity adds the curve back.
      </p>
    </div>
  );
};

// ── QuizGame (scored, gamified) ────────────────────────────────────────────
type GameQ = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

const QuizGame = ({
  props,
}: RendererProps<{ title?: string; questions: GameQ[] }>) => {
  const questions = Array.isArray(props.questions) ? props.questions : [];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  if (questions.length === 0)
    return (
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 text-[13px] text-[var(--ink-2)]">
        No questions yet.
      </div>
    );

  const q = questions[Math.min(idx, questions.length - 1)];
  const answered = picked !== null;

  const reset = () => {
    setIdx(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setFinished(false);
  };

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.correctIndex) {
      // Base 100 + a streak bonus rewards consecutive correct answers.
      setScore((s) => s + 100 + streak * 25);
      setStreak((st) => st + 1);
      setCorrectCount((c) => c + 1);
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIdx((n) => n + 1);
      setPicked(null);
    }
  };

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-2)]">
          Quiz complete
        </span>
        <div className="mt-2 text-[40px] font-bold text-[var(--ink)]">
          {score}
        </div>
        <div className="text-[13px] text-[var(--ink-2)]">
          {correctCount}/{questions.length} correct · {pct}%
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--ink)] text-white mono text-[12.5px] font-medium hover:bg-[#1d1d23] transition"
        >
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-2)]">
          {props.title || "Quiz"} · Q{idx + 1}/{questions.length}
        </span>
        <div className="flex items-center gap-3">
          {streak > 1 && (
            <span className="mono text-[11px] text-[#b86a00]">
              🔥 {streak} streak
            </span>
          )}
          <span className="mono text-[13px] font-semibold text-[var(--ink)]">
            {score} pts
          </span>
        </div>
      </div>

      <p className="mt-3 text-[15px] font-semibold leading-snug text-[var(--ink)]">
        {q.question}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const correct = i === q.correctIndex;
          const state = !answered
            ? "idle"
            : correct
              ? "correct"
              : i === picked
                ? "wrong"
                : "muted";
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={clsx(
                "text-left text-[13.5px] px-3.5 py-2.5 rounded-[10px] border transition",
                state === "idle" &&
                  "border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink-2)] cursor-pointer",
                state === "correct" &&
                  "border-[var(--mint)] bg-[color-mix(in_oklab,var(--mint)_14%,var(--surface))] text-[#0a5d44] font-medium",
                state === "wrong" &&
                  "border-[#e0b4b4] bg-[color-mix(in_oklab,#d66_12%,var(--surface))] text-[#8a2c2c] font-medium",
                state === "muted" &&
                  "border-[var(--line)] text-[var(--ink-2)] opacity-70",
              )}
            >
              {opt}
              {state === "correct" && <span className="ml-2">✓</span>}
              {state === "wrong" && <span className="ml-2">✗</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12.5px] leading-snug text-[var(--ink-2)] flex-1">
            {q.explanation}
          </span>
          <button
            type="button"
            onClick={next}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--ink)] text-white mono text-[12px] font-medium hover:bg-[#1d1d23] transition"
          >
            {idx + 1 >= questions.length ? "Finish" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
};

// ── FreeformUI (open generative surface) ───────────────────────────────────
// The agent writes raw HTML/CSS/SVG; we render it in a SANDBOXED iframe. The
// security model is the whole point:
//   • sandbox="allow-scripts" WITHOUT "allow-same-origin" → the frame is an
//     opaque origin. Agent code can't read our cookies, localStorage, or DOM,
//     and can't make same-origin requests. (Never add allow-same-origin here —
//     combined with allow-scripts it would defeat the sandbox entirely.)
//   • a Content-Security-Policy in the document blocks network exfiltration
//     (connect-src 'none') and external resource loads, so even injected
//     scripts can't phone home.
// Theme tokens are mirrored in so freeform content matches the app. Two-way
// talk uses postMessage: the frame calls window.a2uiAction(name, ctx) and we
// validate the source before turning it into an AG-UI dispatch.

// Brand tokens mirrored from src/a2ui/theme.css + pdf-analyst.css so the
// sandboxed frame (which can't see the parent stylesheet) still looks native.
const FREEFORM_TOKENS = `
  --ink:#010507; --ink-2:#2b2b2b; --line:#dbdbe5; --surface:#ffffff;
  --surface-soft:#f7f7f9; --lilac:#bec2ff; --mint:#85ecce; --orange:#ffac4d;
  --accent:#bec2ff; --muted:#45454a; --muted-2:#5a5a60;
`;

function buildFreeformDoc(html: string, instanceId: string): string {
  const id = JSON.stringify(instanceId);
  // CSP: allow inline styles/scripts and data: images (for self-contained
  // content), block everything else — crucially connect-src 'none' so the
  // frame cannot exfiltrate via fetch/XHR/WebSocket/beacon.
  return [
    "<!doctype html><html><head><meta charset='utf-8'>",
    "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'\">",
    "<style>:root{" + FREEFORM_TOKENS + "}",
    "*{box-sizing:border-box}html,body{margin:0;padding:0}",
    "body{padding:2px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:transparent;font-size:14px;line-height:1.5}",
    "</style></head><body>",
    html,
    "<script>(function(){",
    "function report(){try{parent.postMessage({__a2ui_freeform:true,id:" +
      id +
      ",type:'height',height:document.documentElement.scrollHeight},'*')}catch(e){}}",
    "window.addEventListener('load',report);setTimeout(report,60);setTimeout(report,400);",
    "try{new ResizeObserver(report).observe(document.body)}catch(e){}",
    "window.a2uiAction=function(name,context){try{parent.postMessage({__a2ui_freeform:true,id:" +
      id +
      ",type:'action',name:String(name),context:context||{}},'*')}catch(e){}};",
    "})();<\/script></body></html>",
  ].join("");
}

const FreeformUI = ({
  props,
  dispatch,
}: RendererProps<{ html: string; height?: number; title?: string }>) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const instanceId = useId();
  const [height, setHeight] = useState(props.height ?? 320);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only trust messages from OUR iframe's window, with our tag + id.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow)
        return;
      const d = e.data;
      if (!d || d.__a2ui_freeform !== true || d.id !== instanceId) return;
      if (d.type === "height" && typeof d.height === "number") {
        setHeight(Math.min(2400, Math.max(80, d.height + 6)));
      } else if (d.type === "action" && typeof d.name === "string") {
        dispatch?.({
          event: { name: d.name, context: d.context ?? {} },
        } as never);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instanceId, dispatch]);

  return (
    <div>
      {props.title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] font-semibold text-[var(--ink)]">
            {props.title}
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-2)]">
            generated UI
          </span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title={typeof props.title === "string" ? props.title : "Generated UI"}
        // No allow-same-origin: keep the frame an opaque, isolated origin.
        sandbox="allow-scripts"
        srcDoc={buildFreeformDoc(props.html ?? "", instanceId)}
        style={{ width: "100%", height, border: 0, display: "block" }}
        className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)]"
      />
    </div>
  );
};

// ── GraphExplorer (math signature widget) ──────────────────────────────────
// A safe math-expression evaluator. We compile "an expression in x + named
// params" into a closure WITHOUT eval/Function — the agent supplies the
// expression, so we parse a fixed grammar (recursive descent) instead of
// trusting it as code. Supports + - * / ^, unary -, parens, the funcs below,
// constants pi/e, the variable x, and any named parameter.
type EvalScope = Record<string, number>;
const MATH_FUNCS: Record<string, (a: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  ln: Math.log,
  log: (x) => Math.log10(x),
  sqrt: Math.sqrt,
  abs: Math.abs,
};
const MATH_CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenizeExpr(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    } else if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    } else if ("+-*/^(),".includes(c)) {
      out.push(c);
      i++;
    } else {
      i++; // skip anything unexpected
    }
  }
  return out;
}

type CompiledExpr = (scope: EvalScope) => number;

function compileExpr(src: string): CompiledExpr {
  const t = tokenizeExpr(src);
  let p = 0;
  const peek = () => t[p];
  const next = () => t[p++];

  function parseExpr(): CompiledExpr {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const right = parseTerm();
      const l = left;
      left = op === "+" ? (s) => l(s) + right(s) : (s) => l(s) - right(s);
    }
    return left;
  }
  function parseTerm(): CompiledExpr {
    let left = parsePower();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const right = parsePower();
      const l = left;
      left = op === "*" ? (s) => l(s) * right(s) : (s) => l(s) / right(s);
    }
    return left;
  }
  function parsePower(): CompiledExpr {
    const base = parseUnary();
    if (peek() === "^") {
      next();
      const exp = parsePower(); // right-associative
      return (s) => Math.pow(base(s), exp(s));
    }
    return base;
  }
  function parseUnary(): CompiledExpr {
    if (peek() === "-") {
      next();
      const u = parseUnary();
      return (s) => -u(s);
    }
    if (peek() === "+") {
      next();
      return parseUnary();
    }
    return parseAtom();
  }
  function parseAtom(): CompiledExpr {
    const tok = next();
    if (tok === undefined) return () => NaN;
    if (tok === "(") {
      const e = parseExpr();
      if (peek() === ")") next();
      return e;
    }
    if (/^[0-9.]/.test(tok)) {
      const v = parseFloat(tok);
      return () => v;
    }
    if (peek() === "(") {
      next();
      const arg = parseExpr();
      if (peek() === ")") next();
      const fn = MATH_FUNCS[tok];
      return fn ? (s) => fn(arg(s)) : () => NaN;
    }
    if (tok in MATH_CONSTS) {
      const v = MATH_CONSTS[tok];
      return () => v;
    }
    return (s) => (tok in s ? s[tok] : NaN);
  }

  try {
    return parseExpr();
  } catch {
    return () => NaN;
  }
}

type GraphParam = {
  name: string;
  min: number;
  max: number;
  value: number;
  step?: number;
};

const GraphExplorer = ({
  props,
}: RendererProps<{
  title?: string;
  expression: string;
  params?: GraphParam[];
  xRange?: number[];
  yRange?: number[];
  xLabel?: string;
  yLabel?: string;
}>) => {
  const expr = props.expression || "x";
  const compiled = useMemo(() => compileExpr(expr), [expr]);
  const paramDefs = Array.isArray(props.params) ? props.params : [];
  const [vals, setVals] = useState<EvalScope>(() =>
    Object.fromEntries(paramDefs.map((p) => [p.name, p.value])),
  );

  const [xmin, xmax] =
    Array.isArray(props.xRange) && props.xRange.length === 2
      ? props.xRange
      : [-5, 5];

  // Sample the curve. Keep finite points; split into segments on gaps.
  const W = 640;
  const H = 300;
  const PAD = 34;
  const N = 200;
  const pts: Array<{ x: number; y: number } | null> = [];
  for (let i = 0; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N;
    const y = compiled({ x, ...vals });
    pts.push(Number.isFinite(y) ? { x, y } : null);
  }
  const finite = pts.filter(Boolean) as Array<{ x: number; y: number }>;
  let [ymin, ymax] =
    Array.isArray(props.yRange) && props.yRange.length === 2
      ? props.yRange
      : (() => {
          if (!finite.length) return [-1, 1];
          let lo = Infinity,
            hi = -Infinity;
          for (const pt of finite) {
            if (pt.y < lo) lo = pt.y;
            if (pt.y > hi) hi = pt.y;
          }
          if (lo === hi) {
            lo -= 1;
            hi += 1;
          }
          const pad = (hi - lo) * 0.1;
          return [lo - pad, hi + pad];
        })();
  if (!(ymax > ymin)) {
    ymin = -1;
    ymax = 1;
  }

  const sx = (x: number) => PAD + ((x - xmin) / (xmax - xmin)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - ymin) / (ymax - ymin)) * (H - 2 * PAD);

  // Build path with breaks on non-finite samples.
  let d = "";
  let penDown = false;
  for (const pt of pts) {
    if (!pt) {
      penDown = false;
      continue;
    }
    const X = sx(pt.x).toFixed(1);
    const Y = sy(pt.y).toFixed(1);
    d += `${penDown ? "L" : "M"}${X} ${Y} `;
    penDown = true;
  }

  const showXAxis = ymin <= 0 && ymax >= 0;
  const showYAxis = xmin <= 0 && xmax >= 0;

  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {props.title || "Graph explorer"}
        </span>
        <span className="mono text-[12px] text-[var(--ink-2)]">
          y = {expr}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="mt-3"
        role="img"
        aria-label={`Graph of y = ${expr}`}
      >
        <rect
          x={PAD}
          y={PAD - 14}
          width={W - 2 * PAD}
          height={H - 2 * PAD + 20}
          fill="var(--surface-soft)"
          rx="8"
        />
        {showXAxis && (
          <line
            x1={PAD}
            y1={sy(0)}
            x2={W - PAD}
            y2={sy(0)}
            stroke="var(--line)"
            strokeWidth="1.5"
          />
        )}
        {showYAxis && (
          <line
            x1={sx(0)}
            y1={PAD - 14}
            x2={sx(0)}
            y2={H - PAD + 6}
            stroke="var(--line)"
            strokeWidth="1.5"
          />
        )}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        <text
          x={W - PAD}
          y={H - PAD + 18}
          textAnchor="end"
          className="mono"
          fontSize="11"
          fill="var(--ink-2)"
        >
          {props.xLabel || "x"}
        </text>
      </svg>

      {paramDefs.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          {paramDefs.map((p) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="mono text-[12px] w-6 text-[var(--ink)]">
                {p.name}
              </span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step ?? (p.max - p.min) / 100}
                value={vals[p.name] ?? p.value}
                onChange={(e) =>
                  setVals((v) => ({ ...v, [p.name]: Number(e.target.value) }))
                }
                className="flex-1 accent-[var(--ink)]"
              />
              <span className="mono text-[12px] w-12 text-right text-[var(--ink-2)]">
                {(vals[p.name] ?? p.value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ConceptMap (lecture overview) ──────────────────────────────────────────
type CMNode = { id: string; label: string; level?: number; group?: string };
type CMEdge = { from: string; to: string; label?: string };

const ConceptMap = ({
  props,
  dispatch,
}: RendererProps<{ title?: string; nodes: CMNode[]; edges: CMEdge[] }>) => {
  const nodes = Array.isArray(props.nodes) ? props.nodes : [];
  const edges = Array.isArray(props.edges) ? props.edges : [];

  // Layout: columns by `level` (fall back to declaration order). Within a
  // column, stack nodes vertically and centre them.
  const NODE_W = 150;
  const NODE_H = 46;
  const COL_GAP = 56;
  const ROW_GAP = 18;
  const PAD = 8;

  const byLevel = new Map<number, CMNode[]>();
  nodes.forEach((n, i) => {
    const lvl = typeof n.level === "number" ? n.level : i;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(n);
  });
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(1, ...[...byLevel.values()].map((v) => v.length));
  const colW = NODE_W + COL_GAP;
  const rowH = NODE_H + ROW_GAP;
  const totalH = maxRows * rowH - ROW_GAP + 2 * PAD;
  const totalW = levels.length * colW - COL_GAP + 2 * PAD;

  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((lvl, li) => {
    const col = byLevel.get(lvl)!;
    const colHeight = col.length * rowH - ROW_GAP;
    const yStart = PAD + (totalH - 2 * PAD - colHeight) / 2;
    col.forEach((n, ri) => {
      pos.set(n.id, { x: PAD + li * colW, y: yStart + ri * rowH });
    });
  });

  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
      {props.title && (
        <div className="mb-3 text-[14px] font-semibold text-[var(--ink)]">
          {props.title}
        </div>
      )}
      <svg
        viewBox={`0 0 ${Math.max(totalW, 1)} ${Math.max(totalH, 1)}`}
        width="100%"
        role="img"
        aria-label="Concept map"
      >
        <defs>
          <marker
            id="cm-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M2 1L8 5L2 9"
              fill="none"
              stroke="var(--ink-2)"
              strokeWidth="1.5"
            />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--ink-2)"
              strokeWidth="1.3"
              markerEnd="url(#cm-arrow)"
              opacity="0.55"
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: "pointer" }}
              onClick={() =>
                dispatch?.({
                  event: {
                    name: "focus_topic",
                    context: { topic: n.label, id: n.id },
                  },
                } as never)
              }
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx="10"
                fill="var(--surface-soft)"
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12.5"
                fill="var(--ink)"
              >
                {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[11px] text-[var(--ink-2)]">
        Tap a concept to focus on it.
      </p>
    </div>
  );
};

// ── SimulationLab (Pixel Campus interactive lab — projectile/trajectory) ────
// A self-contained canvas "lab": tune sliders, FIRE, and try to hit the target.
// The agent emits it for motion/physics/optimization topics (the generic
// "tune the parameters to hit the goal" interactive). Ported from the
// pixel-campus UI kit's Trajectory Lab.
const SIM_INK = "#1B2A4A";
const SIM_OUTLINE = "#0E1626";
const SIM_CREAM = "#F4E4C1";
const SIM_GOLD = "#FFC94D";
const SIM_CORAL = "#F0596A";

const SimulationLab = ({
  props,
}: RendererProps<{ title?: string; subject?: string; gravity?: number }>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(60);
  const [gravity, setGravity] = useState(
    Math.round(Number(props.gravity) || 10),
  );
  const [showTrace, setShowTrace] = useState(true);
  const [verdict, setVerdict] = useState<{ hit: boolean; text: string } | null>(
    null,
  );
  const animRef = useRef<number | null>(null);
  const ballRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<{ x: number; r: number }>({ x: 440, r: 18 });
  const peakRef = useRef(0);

  const W = 640;
  const H = 300;
  const GND = H - 24;

  const live = useRef({ angle, power, gravity, showTrace });
  live.current = { angle, power, gravity, showTrace };

  const vel = (a: number, p: number) => {
    const rad = (a * Math.PI) / 180;
    const v = p * 0.42;
    return { vx: Math.cos(rad) * v, vy: Math.sin(rad) * v };
  };

  const predict = () => {
    const { angle: a, power: p, gravity: g } = live.current;
    const { vx, vy } = vel(a, p);
    const pts: [number, number][] = [];
    let t = 0;
    let pk = 0;
    while (true) {
      const cx = 24 + vx * t;
      const cy = GND - (vy * t - 0.5 * g * t * t);
      if (cy > GND && t > 0.2) break;
      pts.push([cx, cy]);
      pk = Math.max(pk, GND - cy);
      t += 0.08;
      if (cx > W + 40 || t > 30) break;
    }
    const range = pts.length ? pts[pts.length - 1][0] - 24 : 0;
    return { pts, range: Math.max(0, Math.round(range / 4)), peak: Math.round(pk / 4) };
  };

  const draw = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    px(0, 0, W, GND * 0.5, "#1C5FB0");
    px(0, GND * 0.5, W, GND * 0.5, "#2E78C0");
    ctx.fillStyle = "#3A7EC0";
    for (let i = 0; i < 14; i++) ctx.fillRect((i * 53) % W, 18 + ((i * 37) % 70), 3, 3);
    px(0, GND, W, 2, SIM_OUTLINE);
    px(0, GND + 2, W, H - GND, "#7E8A99");
    for (let i = 0; i < W; i += 8) px(i, GND + 6, 4, 2, "#6B7686");
    const target = targetRef.current;
    px(target.x - 2, GND - 40, 4, 40, SIM_OUTLINE);
    px(target.x + 2, GND - 40, 18, 12, SIM_CORAL);
    px(target.x + 2, GND - 40, 18, 1, "#fff");
    ctx.fillStyle = SIM_GOLD;
    ctx.beginPath();
    ctx.arc(target.x, GND, target.r, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#E8503C";
    ctx.beginPath();
    ctx.arc(target.x, GND, target.r - 7, 0, 7);
    ctx.fill();
    if (live.current.showTrace) {
      const pr = predict();
      ctx.fillStyle = "#FFD970";
      pr.pts.forEach((p, i) => {
        if (i % 2 === 0) ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 3, 3);
      });
    }
    const rad = (live.current.angle * Math.PI) / 180;
    px(8, GND - 10, 26, 12, "#345F92");
    px(8, GND - 12, 26, 2, SIM_OUTLINE);
    ctx.save();
    ctx.translate(20, GND - 6);
    ctx.rotate(-rad);
    px(0, -4, 22, 8, "#C8432E");
    px(0, -5, 22, 1, SIM_OUTLINE);
    px(0, 4, 22, 1, SIM_OUTLINE);
    ctx.restore();
    const ball = ballRef.current;
    if (ball) {
      px(ball.x - 3, ball.y - 3, 6, 6, SIM_OUTLINE);
      px(ball.x - 2, ball.y - 2, 4, 4, SIM_CREAM);
    }
  };

  useEffect(() => {
    if (animRef.current == null) ballRef.current = null;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle, power, gravity, showTrace]);
  useEffect(
    () => () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    },
    [],
  );

  const settle = () => {
    animRef.current = null;
    draw();
    const ball = ballRef.current;
    if (!ball) return;
    const dist = Math.abs(ball.x - targetRef.current.x);
    if (dist <= targetRef.current.r)
      setVerdict({ hit: true, text: "🎯 Direct hit!  +120 XP" });
    else
      setVerdict({
        hit: false,
        text: "✗ Missed by " + Math.round(dist / 4) + "m — adjust & retry",
      });
  };

  const fire = () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    setVerdict(null);
    const { vx, vy } = vel(live.current.angle, live.current.power);
    const g = live.current.gravity;
    peakRef.current = 0;
    let t = 0;
    ballRef.current = { x: 24, y: GND };
    const step = () => {
      t += 0.08;
      const b = ballRef.current!;
      b.x = 24 + vx * t;
      b.y = GND - (vy * t - 0.5 * g * t * t);
      peakRef.current = Math.max(peakRef.current, GND - b.y);
      if (b.y >= GND && t > 0.2) {
        b.y = GND;
        settle();
        return;
      }
      draw();
      if (b.x > W + 20) {
        settle();
        return;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };

  const reset = () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    ballRef.current = null;
    targetRef.current = { x: 320 + Math.random() * (W - 380), r: 18 };
    setVerdict(null);
    draw();
  };

  const pr = predict();
  const simBtn = (bg: string, color: string): CSSProperties => ({
    fontFamily: "var(--font-press-start), monospace",
    fontSize: "10px",
    border: `3px solid ${SIM_OUTLINE}`,
    boxShadow: `4px 4px 0 ${SIM_OUTLINE}`,
    background: bg,
    color,
    padding: "11px 14px",
    cursor: "pointer",
  });
  const readoutChip = (k: string, v: string) => (
    <span
      key={k}
      style={{
        fontFamily: "var(--font-silkscreen), monospace",
        fontWeight: 700,
        fontSize: "11px",
        background: "rgba(14,22,38,.78)",
        color: SIM_CREAM,
        padding: "5px 8px",
        border: `3px solid ${SIM_OUTLINE}`,
      }}
    >
      {k} <b style={{ color: SIM_GOLD }}>{v}</b>
    </span>
  );

  return (
    <div style={{ border: `4px solid ${SIM_OUTLINE}`, boxShadow: `8px 8px 0 ${SIM_OUTLINE}`, background: SIM_CREAM }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: SIM_INK, borderBottom: `4px solid ${SIM_OUTLINE}`, padding: "10px 14px" }}>
        <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "12px", color: SIM_CREAM }}>
          {props.title || "🚀 Launch Lab"}
        </span>
        <span style={{ fontFamily: "var(--font-silkscreen), monospace", fontWeight: 700, fontSize: "11px", color: SIM_GOLD }}>
          {props.subject || "PHYSICS · LAB"}
        </span>
      </div>
      <div style={{ position: "relative", background: "#0E1626" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: "block", width: "100%", height: 300, imageRendering: "pixelated" }}
        />
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {readoutChip("ANGLE", angle + "°")}
          {readoutChip("POWER", String(power))}
          {readoutChip("GRAVITY", gravity.toFixed(1))}
          {readoutChip("RANGE", pr.range + "m")}
          {readoutChip("PEAK", pr.peak + "m")}
        </div>
      </div>
      <div style={{ padding: 20, background: SIM_CREAM }}>
        {(
          [
            ["ANGLE", angle, 10, 80, setAngle, angle + "°"],
            ["POWER", power, 20, 100, setPower, String(power)],
            ["GRAVITY", gravity, 2, 20, setGravity, gravity.toFixed(0)],
          ] as const
        ).map(([nm, val, min, max, setter, disp]) => (
          <div key={nm} style={{ display: "grid", gridTemplateColumns: "84px 1fr 56px", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontFamily: "var(--font-silkscreen), monospace", fontWeight: 700, fontSize: "11px", color: SIM_INK, letterSpacing: ".04em" }}>{nm}</span>
            <input type="range" min={min} max={max} step={1} value={val} onChange={(e) => setter(Number(e.target.value))} style={{ width: "100%", accentColor: SIM_GOLD }} />
            <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "10px", color: "#E8503C", textAlign: "right" }}>{disp}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          <button type="button" onClick={fire} style={simBtn(SIM_CORAL, "#fff")}>▶ FIRE</button>
          <button type="button" onClick={() => setShowTrace((s) => !s)} style={simBtn(SIM_GOLD, "#2A1A00")}>◌ TRACE</button>
          <button type="button" onClick={reset} style={simBtn(SIM_CREAM, SIM_INK)}>↺ RESET</button>
        </div>
        {verdict && (
          <div
            style={{
              fontFamily: "var(--font-press-start), monospace",
              fontSize: "11px",
              border: `4px solid ${SIM_OUTLINE}`,
              marginTop: 14,
              padding: "10px 12px",
              background: verdict.hit ? SIM_GOLD : SIM_CORAL,
              color: verdict.hit ? "#0C2A10" : "#fff",
            }}
          >
            {verdict.text}
          </div>
        )}
        <p style={{ fontFamily: "var(--font-vt323), monospace", fontSize: "16px", color: SIM_INK, marginTop: 12, textAlign: "center", opacity: 0.8 }}>
          Tune the sliders to hit the 🎯. TRACE shows the predicted arc.
        </p>
      </div>
    </div>
  );
};

function Slot({ render }: { render: ReactNode }) {
  return <>{render}</>;
}

export const renderers = {
  Stack,
  Row,
  Grid,
  Section,
  Card,
  Divider,
  Heading,
  Text,
  Overline,
  Badge,
  Callout,
  BulletList,
  StatCard,
  BarChart,
  HorizontalBarChart,
  LineChart,
  DonutChart,
  ScatterChart,
  DataTable,
  Button,
  ChoiceChips,
  Flashcard,
  QuizQuestion,
  ProgressTracker,
  RateShockSimulator,
  QuizGame,
  FreeformUI,
  GraphExplorer,
  ConceptMap,
  SimulationLab,
};
