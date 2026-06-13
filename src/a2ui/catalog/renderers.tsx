"use client";

import { clsx } from "clsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
}: RendererProps<{ front: string; back: string; hint?: string }>) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="group relative w-full min-h-[150px] text-left rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:border-[var(--ink-2)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
    >
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)]">
        {flipped ? "Answer" : "Term"} · tap to flip
      </span>
      {flipped ? (
        <p className="mt-3 text-[15px] leading-snug text-[var(--ink)]">
          {props.back}
        </p>
      ) : (
        <>
          <p className="mt-3 text-[17px] font-semibold leading-snug text-[var(--ink)]">
            {props.front}
          </p>
          {props.hint && (
            <p className="mt-2 text-[12.5px] italic text-[var(--ink-2)]">
              Hint: {props.hint}
            </p>
          )}
        </>
      )}
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
};
