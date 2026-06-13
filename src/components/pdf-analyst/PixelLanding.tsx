"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { extractPdfText } from "@/lib/pdf";

/* Pixel Campus landing (see DESIGN.md). A single, focused screen: a sunny
 * 16-bit street with the drop-zone "portal" in the middle. Dropping a lecture
 * PDF drives the agent directly (addMessage + runAgent) — the same pattern
 * SurfaceCanvas uses for chip clicks — and the generated workspace replaces
 * this screen once the surface paints. Works in OFFLINE mode with no key. */
/* A built-in sample lecture so "play the sample" generates a real surface even
 * with no upload (the dynamic agent needs a document to compose from). */
const SAMPLE_PROMPT = `Build me a study workspace from these lecture slides.

[Document: Sample — Interest Rate Risk.pdf]
Interest Rate Risk (Investments, Lecture 7).
Bond prices move inversely to interest rates: when yields rise, the price of an existing bond falls. Price sensitivity to rate changes is larger when the maturity is longer, the coupon is lower, and the starting yield is lower.
Macaulay duration is the weighted-average time to a bond's cash flows — a single measure of its effective maturity and rate sensitivity.
Modified duration estimates the percentage price change for a small yield move: dB/B = -D* * dy.
Convexity is the curvature of the price-yield relationship; it corrects duration's straight-line estimate, which under-predicts the price for large rate moves.
Immunization matches the duration of assets to the liability (or investment horizon) so price risk and reinvestment risk offset, locking in a realized yield.`;

export function PixelLanding({
  agentId,
  mode = "overlay",
}: {
  agentId: string;
  /** "overlay" = fixed full-screen cover (default); "page" = normal in-flow
   *  section so other content can sit on the same page beneath it. */
  mode?: "overlay" | "page";
}) {
  const { agent } = useAgent({ agentId });
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<"idle" | "reading" | "generating" | "error">(
    "idle",
  );
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");

  const busy = status === "reading" || status === "generating";

  // Typed topic / link → live web search (Linkup), then build a study level.
  const submitText = () => {
    const q = query.trim();
    if (!q || busy) return;
    setErr("");
    setFileName(q);
    send(
      `Use live web search to research "${q}" and build me a study workspace teaching it — ` +
        `start with the key ideas as simple flip-cards (one emoji + a one-sentence ELI5 each), ` +
        `then a short practice quiz, and cite your sources.`,
    );
  };

  const send = (content: string) => {
    if (!agent) return;
    setStatus("generating");
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content });
    void agent.runAgent().catch((e: unknown) => {
      setErr(String(e));
      setStatus("error");
    });
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setErr("That's not a PDF. Drop your lecture slides as a PDF.");
      setStatus("error");
      return;
    }
    setErr("");
    setFileName(file.name);
    setStatus("reading");
    try {
      const { text } = await extractPdfText(file);
      send(
        `Build me a study workspace from these slides — a concept map of how the ideas connect, ` +
          `the key concepts as simple flip-cards (one emoji + a one-sentence ELI5 each), and a short ` +
          `practice quiz.\n\n[Document: ${file.name}]\n${text.slice(0, 60000)}`,
      );
    } catch {
      setErr("Couldn't read that PDF. Try another file.");
      setStatus("error");
    }
  };

  return (
    <div
      className={`pixel-campus pc-sky overflow-hidden flex flex-col ${
        mode === "overlay"
          ? "fixed inset-0 z-50"
          : "relative w-full h-full overflow-y-auto"
      }`}
    >
      {/* clouds */}
      <div className="pc-cloud" style={{ width: 16, height: 16, top: "14%", left: "16%" }} />
      <div className="pc-cloud" style={{ width: 16, height: 16, top: "22%", right: "20%" }} />
      <div className="pc-cloud" style={{ width: 16, height: 16, top: "9%", left: "60%" }} />

      {/* top HUD */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <span
          className="pc-marquee"
          style={{ fontSize: "1rem", textShadow: "3px 3px 0 var(--pc-outline)" }}
        >
          COPILEARN
        </span>
        <span
          className="pc-hud"
          style={{ color: "var(--pc-primary)", fontSize: "0.8rem", letterSpacing: "0.06em" }}
        >
          ★ PIXEL CAMPUS
        </span>
      </div>

      {/* center stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center -mt-6">
        <span
          className="pc-eyebrow inline-block mb-6"
          style={{ fontSize: "0.6rem", padding: "8px 12px", color: "var(--pc-primary)" }}
        >
          VOL. 1 · LEARN ANYTHING
        </span>

        <h1
          className="pc-marquee mb-3"
          style={{ fontSize: "clamp(1.6rem, 5vw, 3rem)", lineHeight: 1.25 }}
        >
          Enter the level
        </h1>
        <p
          style={{
            fontFamily: "var(--font-vt323), monospace",
            fontSize: "1.5rem",
            color: "var(--pc-primary)",
            marginBottom: "1.5rem",
            textShadow: "2px 2px 0 var(--pc-outline)",
          }}
        >
          Type a topic to research live — or import your slides with +.
        </p>

        {/* chat-bar input: + imports a PDF, typing a topic runs a web search */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) void handleFile(e.dataTransfer.files?.[0]);
          }}
          className="pc-panel"
          style={{
            width: "min(640px, 92vw)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            background: drag ? "var(--pc-gold)" : "var(--pc-primary)",
          }}
        >
          {busy ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 6px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <PixelDisk spinning />
              <span className="pc-hud" style={{ fontSize: "0.9rem", color: "var(--pc-ink)" }}>
                {status === "reading" ? "READING SLIDES…" : "BUILDING YOUR LEVEL…"}
              </span>
              <span className="pc-blink" style={{ color: "var(--pc-ink)" }}>
                ▶
              </span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                title="Import lecture slides (PDF)"
                aria-label="Import slides"
                className="pc-btn pc-btn-secondary"
                style={{ fontSize: "1.1rem", padding: "8px 14px", lineHeight: 1 }}
              >
                +
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitText();
                }}
                placeholder="Type a topic to research, or + to import slides…"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "var(--font-vt323), monospace",
                  fontSize: "1.4rem",
                  color: "var(--pc-ink)",
                }}
              />
              <button
                type="button"
                onClick={submitText}
                aria-label="Go"
                className="pc-btn pc-btn-primary"
                style={{ fontSize: "0.8rem", padding: "10px 14px", lineHeight: 1 }}
              >
                ▶
              </button>
            </>
          )}
        </div>

        {/* sample / error line */}
        <div style={{ marginTop: 16, minHeight: 28 }}>
          {status === "error" ? (
            <span style={{ fontFamily: "var(--font-vt323), monospace", fontSize: "1.2rem", color: "#fff", background: "var(--pc-coral)", padding: "4px 10px", border: "3px solid var(--pc-outline)" }}>
              {err}
            </span>
          ) : (
            !busy && (
              <button
                type="button"
                onClick={() => send(SAMPLE_PROMPT)}
                className="pc-hud"
                style={{ background: "transparent", color: "var(--pc-primary)", fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer" }}
              >
                no idea where to start? play the sample level →
              </button>
            )
          )}
        </div>
      </div>

      {/* town ground strip */}
      <div className="relative z-10" style={{ height: 96 }}>
        {/* simple shopfronts */}
        <div style={{ position: "absolute", bottom: 28, left: "8%", width: 90, height: 54, background: "var(--pc-building)", border: "4px solid var(--pc-outline)" }} />
        <div style={{ position: "absolute", bottom: 70, left: "8%", width: 90, height: 16, background: "var(--pc-roof)", border: "4px solid var(--pc-outline)" }} />
        <div style={{ position: "absolute", bottom: 28, right: "10%", width: 110, height: 60, background: "var(--pc-building)", border: "4px solid var(--pc-outline)" }} />
        <div style={{ position: "absolute", bottom: 76, right: "10%", width: 110, height: 16, background: "var(--pc-roof)", border: "4px solid var(--pc-outline)" }} />
        {/* road */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "var(--pc-ground)", borderTop: "4px solid var(--pc-outline)" }} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

/* A tiny pixel floppy-disk / cartridge built from squares. */
function PixelDisk({ spinning }: { spinning?: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        width: 44,
        height: 44,
        background: "var(--pc-sky-top)",
        border: "4px solid var(--pc-outline)",
        position: "relative",
        animation: spinning ? "pc-blink 0.6s steps(1) infinite" : undefined,
      }}
    >
      <div style={{ position: "absolute", top: 5, left: 10, width: 24, height: 12, background: "var(--pc-primary)", border: "3px solid var(--pc-outline)" }} />
      <div style={{ position: "absolute", bottom: 5, left: 14, width: 16, height: 12, background: "var(--pc-gold)", border: "3px solid var(--pc-outline)" }} />
    </div>
  );
}
