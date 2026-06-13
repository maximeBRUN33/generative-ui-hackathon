"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { extractPdfText } from "@/lib/pdf";
import { PixelProgress } from "@/components/pdf-analyst/PixelProgress";

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
        `Build me a COMPACT study workspace from these slides — about 5 flip-cards ` +
          `(emoji + a one-sentence ELI5 each) and a 4-question quiz. Keep it tight and fast.` +
          `\n\n[Document: ${file.name}]\n${text.slice(0, 20000)}`,
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
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "10px 6px",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PixelDisk spinning />
                <span className="pc-hud" style={{ fontSize: "0.9rem", color: "var(--pc-ink)" }}>
                  {status === "reading" ? "READING SLIDES…" : "BUILDING YOUR LEVEL…"}
                </span>
                <span className="pc-blink" style={{ color: "var(--pc-ink)" }}>
                  ▶
                </span>
              </div>
              <PixelProgress
                label={status === "reading" ? "Reading slides" : "Composing your level"}
              />
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

      {/* town street — packed Pixel Campus: a big university, houses, shops,
          trees, cars, and students (men & women) strolling with backpacks */}
      <div className="relative z-10" style={{ height: 248 }}>
        {/* skyline (back to front) */}
        <House leftPct="1%" width={118} height={150} color="#4f7bb0" />
        <Shopfront leftPct="17%" width={116} />
        <University leftPct="33%" />
        <Shopfront rightPct="18%" width={116} />
        <House rightPct="1%" width={122} height={162} color="var(--pc-building)" />

        {/* sidewalk band */}
        <div style={{ position: "absolute", bottom: 30, left: 0, right: 0, height: 20, background: "color-mix(in oklab, var(--pc-ground) 60%, #fff)", borderTop: "4px solid var(--pc-outline)" }} />
        {/* road */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 30, background: "var(--pc-ground)", borderTop: "4px solid var(--pc-outline)" }} />
        {/* dashed centre line */}
        <div style={{ position: "absolute", bottom: 13, left: 0, right: 0, height: 3, background: "repeating-linear-gradient(90deg, var(--pc-gold) 0 22px, transparent 22px 44px)" }} />

        {/* trees on the sidewalk (in front of the buildings) */}
        <Tree leftPct="15%" h={62} />
        <Tree leftPct="31%" h={78} />
        <Tree leftPct="62%" h={66} />
        <Tree rightPct="14%" h={72} />

        {/* a parked car + one driving across the road */}
        <div style={{ position: "absolute", bottom: 3, left: "9%" }}><Car color="var(--pc-gold)" /></div>
        <div className="pc-walker" style={{ bottom: 3, animation: "pc-stroll 12s linear infinite", animationDelay: "-3s" }}>
          <Car color="var(--pc-coral)" />
        </div>

        {/* students (men & women) with backpacks */}
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll 15s linear infinite" }}><div className="pc-bob"><PixelStudent shirt="var(--pc-coral)" pack="var(--pc-gold)" /></div></div>
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll 19s linear infinite", animationDelay: "-7s" }}><div className="pc-bob"><PixelStudent female shirt="var(--pc-awning)" pack="var(--pc-gold)" hair="#5a3210" /></div></div>
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll 24s linear infinite", animationDelay: "-13s" }}><div className="pc-bob"><PixelStudent shirt="var(--pc-success)" pack="var(--pc-coral)" hair="#101a30" /></div></div>
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll-rev 26s linear infinite", animationDelay: "-4s" }}><div className="pc-bob"><PixelStudent shirt="var(--pc-sky-top)" pack="var(--pc-gold)" skin="#caa06f" /></div></div>
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll-rev 18s linear infinite", animationDelay: "-9s" }}><div className="pc-bob"><PixelStudent female shirt="var(--pc-coral)" pack="var(--pc-success)" skin="#caa06f" hair="#101a30" /></div></div>
        <div className="pc-walker" style={{ bottom: 48, animation: "pc-stroll 29s linear infinite", animationDelay: "-17s" }}><div className="pc-bob"><PixelStudent female shirt="var(--pc-gold)" pack="var(--pc-sky-top)" hair="#3a2a1a" /></div></div>
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

/* A pixel shopfront: facade + roof + striped market awning + two windows + a
 * door. Anchored on the sidewalk (bottom: 50). Each shop is a "subject". */
function Shopfront({
  leftPct,
  rightPct,
  width = 150,
}: {
  leftPct?: string;
  rightPct?: string;
  width?: number;
}) {
  const out = "4px solid var(--pc-outline)";
  return (
    <div style={{ position: "absolute", bottom: 50, left: leftPct, right: rightPct, width, height: 110 }}>
      {/* roof */}
      <div style={{ position: "absolute", top: 0, left: -4, right: -4, height: 16, background: "var(--pc-roof)", border: out }} />
      {/* facade */}
      <div style={{ position: "absolute", top: 14, left: 0, right: 0, bottom: 0, background: "var(--pc-building)", border: out }} />
      {/* windows */}
      <div style={{ position: "absolute", top: 26, left: 12, width: 30, height: 24, background: "var(--pc-sky-bottom)", border: "3px solid var(--pc-outline)" }} />
      <div style={{ position: "absolute", top: 26, right: 12, width: 30, height: 24, background: "var(--pc-sky-bottom)", border: "3px solid var(--pc-outline)" }} />
      {/* striped awning */}
      <div className="pc-awning-stripes" style={{ position: "absolute", top: 56, left: -4, right: -4, height: 16, border: "3px solid var(--pc-outline)" }} />
      {/* door */}
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 34, height: 44, background: "var(--pc-ink)", border: out }} />
      {/* door knob */}
      <div style={{ position: "absolute", bottom: 20, left: "calc(50% + 9px)", width: 6, height: 6, background: "var(--pc-coral)" }} />
    </div>
  );
}

/* A pixel tree: chunky green foliage blocks on a brown trunk. */
function Tree({ leftPct, rightPct, h = 70 }: { leftPct?: string; rightPct?: string; h?: number }) {
  const out = "3px solid var(--pc-outline)";
  return (
    <div style={{ position: "absolute", bottom: 50, left: leftPct, right: rightPct, width: 44, height: h }}>
      <div style={{ position: "absolute", top: 0, left: 4, width: 36, height: h - 24, background: "var(--pc-success)", border: out }} />
      <div style={{ position: "absolute", top: 10, left: -4, width: 14, height: 16, background: "var(--pc-success)", border: out }} />
      <div style={{ position: "absolute", top: 10, right: -4, width: 14, height: 16, background: "var(--pc-success)", border: out }} />
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 12, height: 26, background: "#6b4a2a", border: out }} />
    </div>
  );
}

/* A pixel car: cabin + window + body + two square wheels. */
function Car({ color = "var(--pc-coral)" }: { color?: string }) {
  const out = "3px solid var(--pc-outline)";
  return (
    <div aria-hidden style={{ position: "relative", width: 76, height: 34, imageRendering: "pixelated" }}>
      <div style={{ position: "absolute", top: 0, left: 18, width: 40, height: 14, background: color, border: out }} />
      <div style={{ position: "absolute", top: 3, left: 24, width: 28, height: 8, background: "var(--pc-sky-bottom)" }} />
      <div style={{ position: "absolute", top: 12, left: 0, width: 76, height: 15, background: color, border: out }} />
      <div style={{ position: "absolute", bottom: 0, left: 10, width: 14, height: 14, background: "var(--pc-outline)" }} />
      <div style={{ position: "absolute", bottom: 0, right: 10, width: 14, height: 14, background: "var(--pc-outline)" }} />
    </div>
  );
}

/* A taller residential building: roof band + a 2x2 window grid + door. */
function House({
  leftPct,
  rightPct,
  width = 124,
  height = 152,
  color = "var(--pc-building)",
}: {
  leftPct?: string;
  rightPct?: string;
  width?: number;
  height?: number;
  color?: string;
}) {
  const out = "4px solid var(--pc-outline)";
  return (
    <div style={{ position: "absolute", bottom: 50, left: leftPct, right: rightPct, width, height }}>
      <div style={{ position: "absolute", top: 0, left: -4, right: -4, height: 14, background: "var(--pc-roof)", border: out }} />
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 0, background: color, border: out }} />
      {[0, 1].map((r) =>
        [0, 1].map((cl) => (
          <div
            key={`${r}-${cl}`}
            style={{
              position: "absolute",
              top: 26 + r * 40,
              left: cl === 0 ? 16 : undefined,
              right: cl === 1 ? 16 : undefined,
              width: 28,
              height: 24,
              background: "var(--pc-sky-bottom)",
              border: "3px solid var(--pc-outline)",
            }}
          />
        )),
      )}
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 30, height: 36, background: "var(--pc-ink)", border: out }} />
    </div>
  );
}

/* The big university landmark: pediment + flag + columns + banner + grand door. */
function University({ leftPct, rightPct }: { leftPct?: string; rightPct?: string }) {
  const out = "4px solid var(--pc-outline)";
  return (
    <div style={{ position: "absolute", bottom: 50, left: leftPct, right: rightPct, width: 232, height: 172 }}>
      {/* flag */}
      <div style={{ position: "absolute", top: -8, left: "50%", width: 3, height: 16, background: "var(--pc-outline)" }} />
      <div style={{ position: "absolute", top: -8, left: "calc(50% + 3px)", width: 20, height: 12, background: "var(--pc-gold)", border: "2px solid var(--pc-outline)" }} />
      {/* pediment (stepped → temple roof) */}
      <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 96, height: 16, background: "var(--pc-roof)", border: out }} />
      <div style={{ position: "absolute", top: 22, left: 10, right: 10, height: 18, background: "var(--pc-roof)", border: out }} />
      {/* main hall */}
      <div style={{ position: "absolute", top: 38, left: 0, right: 0, bottom: 0, background: "#e8ddc0", border: out }} />
      {/* banner */}
      <div style={{ position: "absolute", top: 46, left: "50%", transform: "translateX(-50%)", padding: "3px 8px", background: "var(--pc-gold)", border: "3px solid var(--pc-outline)" }}>
        <span className="pc-hud" style={{ fontSize: "0.5rem", letterSpacing: "0.08em", color: "var(--pc-outline)" }}>
          UNIVERSITY
        </span>
      </div>
      {/* columns */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", bottom: 0, left: 18 + i * 56, width: 18, height: 88, background: "var(--pc-primary)", border: out }} />
      ))}
      {/* grand door */}
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 48, height: 62, background: "var(--pc-ink)", border: out }} />
    </div>
  );
}

/* A chunky 16-bit student with a backpack, built from outlined squares.
 * Faces right; the parent .pc-walker handles the stroll (scaleX flips it).
 * `female` adds side hair + a skirt so the crowd reads as men AND women. */
function PixelStudent({
  shirt,
  pack,
  skin = "#e8b88a",
  hair = "#3a2a1a",
  pants = "#22324f",
  female = false,
}: {
  shirt: string;
  pack: string;
  skin?: string;
  hair?: string;
  pants?: string;
  female?: boolean;
}) {
  const out = "2px solid var(--pc-outline)";
  return (
    <div
      aria-hidden
      style={{ position: "relative", width: 30, height: 46, transform: "scale(1.35)", transformOrigin: "bottom center", imageRendering: "pixelated" }}
    >
      {/* backpack (behind the shoulders, to the left when facing right) */}
      <div style={{ position: "absolute", left: 0, top: 17, width: 11, height: 17, background: pack, border: out }} />
      {/* shoulder strap */}
      <div style={{ position: "absolute", left: 9, top: 17, width: 4, height: 15, background: pack, border: out }} />
      {/* head */}
      <div style={{ position: "absolute", left: 9, top: 0, width: 13, height: 12, background: skin, border: out }} />
      {/* hair cap */}
      <div style={{ position: "absolute", left: 9, top: 0, width: 13, height: 5, background: hair }} />
      {female && <div style={{ position: "absolute", left: 8, top: 4, width: 4, height: 12, background: hair }} />}
      {female && <div style={{ position: "absolute", left: 19, top: 4, width: 4, height: 12, background: hair }} />}
      {/* torso / shirt */}
      <div style={{ position: "absolute", left: 7, top: 14, width: 15, height: 16, background: shirt, border: out }} />
      {/* lower body: skirt + short legs (female) or trousers (male) */}
      {female ? (
        <>
          <div style={{ position: "absolute", left: 5, top: 29, width: 19, height: 10, background: shirt, border: out }} />
          <div style={{ position: "absolute", left: 9, top: 38, width: 4, height: 7, background: pants, border: out }} />
          <div style={{ position: "absolute", left: 16, top: 38, width: 4, height: 7, background: pants, border: out }} />
        </>
      ) : (
        <>
          <div style={{ position: "absolute", left: 8, top: 31, width: 6, height: 13, background: pants, border: out }} />
          <div style={{ position: "absolute", left: 16, top: 31, width: 6, height: 13, background: pants, border: out }} />
        </>
      )}
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
