import {
  Plus_Jakarta_Sans,
  Spline_Sans_Mono,
  Press_Start_2P,
  Silkscreen,
  VT323,
} from "next/font/google";
// CopilotChat v2 styles (scoped in effect — the .copilot-* classes only
// appear inside the pdf-analyst chat panels).
import "@copilotkit/react-ui/v2/styles.css";
// A2UI surface tokens, scoped to .a2ui-surface — safe, additive.
import "@/a2ui/theme.css";
// pdf-analyst brand tokens + chrome, scoped to .pdf-analyst-root (this
// segment's wrapper) so host :root tokens are never clobbered.
import "./pdf-analyst.css";
// Pixel Campus design system (see DESIGN.md), scoped to .pixel-campus.
import "./pixel-campus.css";
import { Providers } from "@/components/pdf-analyst/Providers";

/* pdf-analyst was authored against --font-plus-jakarta / --font-spline-mono.
 * The host root layout exposes Plus Jakarta / Spline Mono under different
 * variable names (--font-body-loader / --font-code-loader), so we load them
 * again here under the names the pdf-analyst CSS + components expect and set
 * them on the segment wrapper. */
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  display: "swap",
});

/* Pixel Campus voices (see DESIGN.md): Press Start 2P = marquees/titles,
 * Silkscreen = HUD/labels, VT323 = dialogue/reading. */
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/* Segment layout for /pdf-analyst/*. Deliberately NOT a root layout — the
 * host `src/app/layout.tsx` owns <html>/<body>. This only mounts the
 * pdf-analyst CopilotKit provider and scopes the pdf-analyst design tokens
 * to a wrapper element. */
export default function PdfAnalystLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      <div
        className={`pdf-analyst-root ${plusJakarta.variable} ${splineMono.variable} ${pressStart.variable} ${silkscreen.variable} ${vt323.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
      </div>
    </Providers>
  );
}
