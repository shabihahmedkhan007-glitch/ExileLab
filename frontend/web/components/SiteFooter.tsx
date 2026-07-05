// Site footer — the site-wide chrome footer (landing, /goals, /legal/*, /r/*).
// Carries the non-negotiable non-affiliation disclaimer one-liner (PRD §5.4:
// "required disclaimer everywhere") plus links to the legal pages and the Goal
// Preset gallery. Rendered once in the root layout so every route gets it
// without restructuring any page. Plain server component — no client state.

import Link from "next/link";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/goals", label: "Goal Presets" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center rounded bg-accent text-[9px] font-bold text-white"
            >
              E
            </span>
            <span className="font-serif text-sm tracking-tight text-muted">
              ExileLab
            </span>
          </span>
          {/* PRD §5.4 — verbatim, site-wide. */}
          <span className="max-w-prose">
            This product isn&apos;t affiliated with or endorsed by Grinding Gear
            Games in any way.
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
