// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMIZATION SEAM #2 — Re-brand the shell
// See HACKATHON.md §2 for the full recipe.
//
// The pdf-analyst chrome: Logo, SiteNav (top nav), PageHeader (landing
// hero), WorkspaceHeader (the /fixed and /dynamic workspace bar). Swap the
// logo asset in public/brand/, rename the product, rewrite the hero copy.
// Brand tints come from src/app/(pdf)/pdf-analyst.css (Seam #1).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import Link from "next/link";

// Copilearn wordmark. A text mark keeps branding in code (no SVG asset to
// ship) and re-themes automatically via the brand tokens in pdf-analyst.css.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2" style={{ height: size }}>
      <span
        className="grid place-items-center rounded-[7px] bg-[var(--ink)] text-white font-bold"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        C
      </span>
      <span
        className="font-semibold tracking-tight text-[var(--ink)]"
        style={{ fontSize: size * 0.82 }}
      >
        Copilearn
      </span>
    </span>
  );
}

export function SiteNav({
  active: _active,
}: {
  active?: "home" | "fixed" | "dynamic" | "catalog";
}) {
  // Single screen, no tabs — just the wordmark. (Catalog/overview routes still
  // exist for dev, they're just not surfaced in the nav.)
  return (
    <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="max-w-[1480px] mx-auto px-5 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={22} />
        </Link>
      </div>
    </header>
  );
}

/** Used only on overview & catalog pages. never on demo pages where the
 *  whole viewport is workspace. Compact, no atmosphere, no gradient. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--line)] bg-[var(--bg)]">
      <div className="max-w-[1480px] mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
            {eyebrow}
          </span>
          {meta}
        </div>
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight leading-[1.1] text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-2 text-[var(--muted)] max-w-2xl text-[15px] leading-relaxed">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

/** Used by the demo pages. A thin one-row title strip. no hero, no gradient,
 *  no overflow. Sits between the nav and the workspace split. */
export function WorkspaceHeader({
  eyebrow,
  title,
  agentId,
  status,
}: {
  eyebrow: string;
  title: string;
  agentId: string;
  status?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-[var(--line)] bg-[var(--bg)]">
      <div className="max-w-[1480px] mx-auto px-5 py-3 flex items-center gap-4">
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
          {eyebrow}
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-[var(--ink)]">
          {title}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--line)] bg-[var(--surface)] text-[10.5px] uppercase tracking-[0.12em] mono text-[var(--muted)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--lilac)]" />
          agent: {agentId}
        </span>
        <div className="ml-auto flex items-center gap-3">{status}</div>
      </div>
    </div>
  );
}
