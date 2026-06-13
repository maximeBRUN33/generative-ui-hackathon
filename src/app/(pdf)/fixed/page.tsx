"use client";

import { useEffect, useState } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { SurfaceCanvas } from "@/components/pdf-analyst/SurfaceCanvas";
import { FilteredUserMessage } from "@/components/pdf-analyst/FilteredUserMessage";
import { FilteredAssistantMessage } from "@/components/pdf-analyst/FilteredAssistantMessage";
import { PixelLanding } from "@/components/pdf-analyst/PixelLanding";
import { StudyBuddy } from "@/components/pdf-analyst/StudyBuddy";
import { surfaceBus } from "@/a2ui/surface-bus";

const AGENT_ID = "dynamic_agent";

/* Single-screen experience (Pixel Campus). One sky page: drop a lecture →
 * the generated study workspace renders right here, on the same sky design.
 * NO chat panel — the CopilotChat below is mounted OFF-SCREEN only so the
 * activity → surfaceBus pipeline (MirrorRenderer) keeps feeding the canvas. */
export default function FixedPage() {
  const [hasSurface, setHasSurface] = useState(false);
  useEffect(() => {
    setHasSurface(!!surfaceBus.snapshot(AGENT_ID).surfaceId);
    return surfaceBus.subscribe(AGENT_ID, (snap) => {
      if (snap.surfaceId) setHasSurface(true);
    });
  }, []);

  return (
    <div className="pixel-campus pc-sky h-screen flex flex-col overflow-hidden">
      {hasSurface && (
        <header
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b-[3px]"
          style={{ borderColor: "var(--pc-outline)" }}
        >
          <span
            className="pc-marquee"
            style={{ fontSize: "1rem", textShadow: "3px 3px 0 var(--pc-outline)" }}
          >
            COPILEARN
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pc-btn pc-btn-secondary"
            style={{ fontSize: "0.58rem", padding: "10px 14px" }}
          >
            ↑ NEW LECTURE
          </button>
        </header>
      )}

      <div className="flex-1 min-h-0">
        {!hasSurface ? (
          <PixelLanding agentId={AGENT_ID} mode="page" />
        ) : (
          <>
            <div className="h-full flex justify-center">
              <div className="w-full max-w-[1120px] h-full">
                <SurfaceCanvas channel={AGENT_ID} emptyState={null} />
              </div>
            </div>
            <StudyBuddy agentId={AGENT_ID} />
          </>
        )}
      </div>

      {/* Off-screen chat: never shown, only present so MirrorRenderer can turn
          the agent's A2UI activity messages into surfaceBus updates. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-200vw",
          top: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <CopilotChat
          agentId={AGENT_ID}
          chatView={{
            messageView: {
              userMessage: FilteredUserMessage,
              assistantMessage: FilteredAssistantMessage,
            },
          }}
        />
      </div>
    </div>
  );
}
