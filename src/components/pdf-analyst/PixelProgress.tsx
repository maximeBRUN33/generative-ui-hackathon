"use client";

import { useEffect, useState } from "react";

/* Pixel Campus loading bar. An LLM turn can't report a true completion %, so
 * this is an honest ESTIMATE: it eases up and caps at ~95% while the agent
 * works, and the caller hides it the instant the run actually completes
 * (surface arrives / runAgent resolves). Kit-styled segmented track + a live
 * percentage so the user always sees motion and roughly where things are. */
export function PixelProgress({ label }: { label?: string }) {
  const [pct, setPct] = useState(4);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      // keep creeping toward 99 (never hard-stalls), slowing as it climbs, so
      // it never looks frozen. The caller hides it on real completion.
      setPct((p) => (p >= 99 ? 99 : p + Math.max(0.35, (99 - p) * 0.04)));
      setSecs(Math.round((performance.now() - start) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const shown = Math.min(99, Math.round(pct));
  const litSegments = Math.round(shown / 10);

  return (
    <div className="pixel-campus" style={{ width: "100%", maxWidth: 320 }}>
      <div
        className="pc-hud"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.72rem",
          letterSpacing: "0.04em",
          color: "var(--pc-ink)",
          marginBottom: 6,
        }}
      >
        <span>{label ?? "Working"}</span>
        <span style={{ color: "var(--pc-coral)" }}>
          {shown}% · {secs}s
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 3,
          height: 18,
          background: "var(--pc-outline)",
          padding: 3,
          border: "3px solid var(--pc-outline)",
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i < litSegments ? "var(--pc-gold)" : "#33405e",
            }}
          />
        ))}
      </div>
    </div>
  );
}
