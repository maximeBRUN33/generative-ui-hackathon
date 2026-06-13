"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { extractPdfText } from "@/lib/pdf";

/* Pixel Campus landing (see DESIGN.md). A single, focused screen: a sunny
 * 16-bit street with the drop-zone "portal" in the middle. Dropping a lecture
 * PDF drives the agent directly (addMessage + runAgent) — the same pattern
 * SurfaceCanvas uses for chip clicks — and the generated workspace replaces
 * this screen once the surface paints. Works in OFFLINE mode with no key. */
export function PixelLanding({ agentId }: { agentId: string }) {
  const { agent } = useAgent({ agentId });
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<"idle" | "reading" | "generating" | "error">(
    "idle",
  );
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");

  const busy = status === "reading" || status === "generating";

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
        `Build my study workspace from these lecture slides.\n\n[Document: ${file.name}]\n${text.slice(
          0,
          60000,
        )}`,
      );
    } catch {
      setErr("Couldn't read that PDF. Try another file.");
      setStatus("error");
    }
  };

  return (
    <div className="pixel-campus pc-sky fixed inset-0 z-50 overflow-hidden flex flex-col">
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
          VOL. 1 · DROP A LECTURE
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
            marginBottom: "2rem",
            textShadow: "2px 2px 0 var(--pc-outline)",
          }}
        >
          Drop your lecture slides. We build the study level from what's inside.
        </p>

        {/* the portal / dropzone */}
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
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
          className={`pc-dropzone ${drag ? "is-drag" : ""}`}
          style={{
            width: "min(520px, 90vw)",
            minHeight: 200,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          {busy ? (
            <>
              <PixelDisk spinning />
              <span className="pc-hud" style={{ fontSize: "0.95rem", color: "var(--pc-ink)" }}>
                {status === "reading" ? "READING SLIDES…" : "BUILDING YOUR LEVEL…"}
              </span>
              <span style={{ fontFamily: "var(--font-vt323), monospace", fontSize: "1.1rem", color: "var(--pc-ink)" }}>
                {fileName || "sample lecture"} <span className="pc-blink">▶</span>
              </span>
            </>
          ) : (
            <>
              <PixelDisk />
              <span
                className="pc-pixel-label"
                style={{ fontSize: "0.72rem", color: "var(--pc-ink)", lineHeight: 1.6 }}
              >
                DROP LECTURE SLIDES
              </span>
              <span style={{ fontFamily: "var(--font-vt323), monospace", fontSize: "1.2rem", color: "var(--pc-ink)", opacity: 0.8 }}>
                or click to insert a PDF
              </span>
              <span className="pc-btn pc-btn-primary" style={{ fontSize: "0.6rem", padding: "12px 16px", marginTop: 6 }}>
                INSERT LECTURE
              </span>
            </>
          )}
        </button>

        {/* sample / error line */}
        <div style={{ marginTop: 18, minHeight: 28 }}>
          {status === "error" ? (
            <span style={{ fontFamily: "var(--font-vt323), monospace", fontSize: "1.2rem", color: "#fff", background: "var(--pc-coral)", padding: "4px 10px", border: "3px solid var(--pc-outline)" }}>
              {err}
            </span>
          ) : (
            !busy && (
              <button
                type="button"
                onClick={() => send("Build my study workspace.")}
                className="pc-hud"
                style={{ background: "transparent", color: "var(--pc-primary)", fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer" }}
              >
                no slides handy? play the sample level →
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
