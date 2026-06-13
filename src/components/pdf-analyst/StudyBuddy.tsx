"use client";

import { useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PixelProgress } from "@/components/pdf-analyst/PixelProgress";

/* Pixel Campus study-buddy: a 16-bit boy with a backpack who sits in the right
 * margin of a generated surface and offers a mini-game. "Yes" asks the agent to
 * build a 5-level gamified game about the current lecture (rendered as a
 * FreeformUI pixel game in the canvas). "No" dismisses him. Pixel style only. */

const MINIGAME_PROMPT =
  "Let's play a mini-game! Build me a 5-LEVEL mini-game about the lecture I " +
  "uploaded — each level harder than the last, very gamified (3 lives, a score, " +
  "a LEVEL x/5 meter, win/lose feedback), and teach me something NEW about the " +
  "subject at every level. Render it as ONE self-contained FreeformUI pixel " +
  "game in the Pixel Campus style.";

export function StudyBuddy({ agentId }: { agentId: string }) {
  const { agent } = useAgent({ agentId });
  const [state, setState] = useState<"ask" | "dismissed" | "playing">("ask");

  if (state === "dismissed") return null;

  const playYes = () => {
    if (!agent) return;
    setState("playing");
    agent.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: MINIGAME_PROMPT,
    });
    // Resolve when the run actually finishes (the game is now in the canvas)
    // — that's our real "100%": hide the buddy so the game takes over.
    void agent
      .runAgent()
      .then(() => setState("dismissed"))
      .catch(() => setState("ask"));
  };

  return (
    <div className="pixel-campus pc-buddy" aria-live="polite">
      {state === "ask" && (
        <div className="pc-bubble">
          <p className="pc-bubble-text">Do you want to play a mini-game?</p>
          <div className="pc-bubble-btns">
            <button
              type="button"
              className="pc-btn pc-btn-primary"
              style={{ fontSize: "0.58rem", padding: "8px 12px", lineHeight: 1 }}
              onClick={playYes}
            >
              YES ▶
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-secondary"
              style={{ fontSize: "0.58rem", padding: "8px 12px", lineHeight: 1 }}
              onClick={() => setState("dismissed")}
            >
              NO
            </button>
          </div>
          <span className="pc-bubble-tail" />
        </div>
      )}
      {state === "playing" && (
        <div className="pc-bubble" style={{ maxWidth: 240 }}>
          <p className="pc-bubble-text" style={{ marginBottom: 8 }}>
            Building your game<span className="pc-blink">…</span>
          </p>
          <PixelProgress label="Building game" />
          <span className="pc-bubble-tail" />
        </div>
      )}
      <PixelBoy />
    </div>
  );
}

/* A chunky 16-bit boy with a backpack, built from outlined squares. Faces left
 * (toward the page content). Idle-bobs via .pc-bob. */
function PixelBoy() {
  const out = "3px solid var(--pc-outline)";
  return (
    <div
      aria-hidden
      className="pc-bob"
      style={{ position: "relative", width: 56, height: 92, imageRendering: "pixelated" }}
    >
      {/* backpack (on the right shoulder since he faces left) */}
      <div style={{ position: "absolute", right: 0, top: 34, width: 15, height: 26, background: "var(--pc-coral)", border: out }} />
      <div style={{ position: "absolute", right: 12, top: 34, width: 5, height: 24, background: "var(--pc-coral)", border: out }} />
      {/* head */}
      <div style={{ position: "absolute", left: 14, top: 2, width: 26, height: 24, background: "#e8b88a", border: out }} />
      {/* hair cap */}
      <div style={{ position: "absolute", left: 14, top: 2, width: 26, height: 8, background: "#3a2a1a" }} />
      {/* eyes (looking left) */}
      <div style={{ position: "absolute", left: 19, top: 14, width: 4, height: 4, background: "var(--pc-outline)" }} />
      <div style={{ position: "absolute", left: 28, top: 14, width: 4, height: 4, background: "var(--pc-outline)" }} />
      {/* torso */}
      <div style={{ position: "absolute", left: 10, top: 30, width: 30, height: 32, background: "var(--pc-sky-top)", border: out }} />
      {/* legs */}
      <div style={{ position: "absolute", left: 12, top: 62, width: 11, height: 26, background: "#22324f", border: out }} />
      <div style={{ position: "absolute", left: 27, top: 62, width: 11, height: 26, background: "#22324f", border: out }} />
    </div>
  );
}
