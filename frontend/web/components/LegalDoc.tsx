// LegalDoc — the shared dark-themed prose shell for the /legal/* pages. Keeps
// the three documents visually identical: a serif title, an optional DRAFT
// banner (ToS + privacy are placeholders pending attorney review — PRD §7.4),
// and a constrained, readable measure. Pure presentational.

import type { ReactNode } from "react";

export function DraftBanner() {
  return (
    <div
      className="mb-8 rounded-[var(--radius)] border px-4 py-3 text-sm"
      style={{
        color: "var(--color-sev-major)",
        borderColor:
          "color-mix(in oklab, var(--color-sev-major) 40%, transparent)",
        background:
          "color-mix(in oklab, var(--color-sev-major) 10%, transparent)",
      }}
    >
      <strong className="font-semibold">DRAFT</strong> — attorney review required
      before launch (PRD §7.4). This is placeholder scaffolding, not legal
      advice, and is not the final policy.
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-ink">
        {heading}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export function LegalDoc({
  title,
  updated,
  draft = false,
  children,
}: {
  title: string;
  updated: string;
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl py-14 md:py-20">
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-xs text-faint">Last updated {updated}</p>
      </header>
      {draft ? <DraftBanner /> : null}
      {children}
    </article>
  );
}
