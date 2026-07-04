import { PasteBox } from "@/components/PasteBox";

interface ProductCard {
  verb: string;
  promise: string;
  icon: string;
  phase?: string;
}

const CARDS: ProductCard[] = [
  {
    verb: "Tune",
    promise:
      "Rank changes by what you want — move a slider, watch the list re-rank.",
    icon: "🎚",
  },
  {
    verb: "Doctor",
    promise:
      "A goal-aware diagnosis: graded categories, severity-sorted findings, real fixes.",
    icon: "🩺",
  },
  {
    verb: "Compare",
    promise:
      "Your build vs top public builds — re-scored under YOUR priorities.",
    icon: "⚖",
    phase: "coming in Phase 3",
  },
  {
    verb: "Upgrades",
    promise: "Budget upgrade finder, ranked by score-per-divine.",
    icon: "💠",
    phase: "coming in Phase 3",
  },
];

export default function LandingPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Path of Exile 2 build optimizer
        </p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink md:text-5xl">
          The best build isn&apos;t max&nbsp;DPS.
          <br />
          It&apos;s the one that fits{" "}
          <span className="text-accent-strong">how you play.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
          Paste a build. We measure it with a deterministic engine and rank every
          change against <em>your</em> weighted priorities — not a leaderboard&apos;s.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <PasteBox />
      </div>

      {/* Named products, not features (Raidbots pattern, UX §2.1) */}
      <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div
            key={c.verb}
            className={`card group relative p-5 transition-colors ${
              c.phase
                ? "opacity-70"
                : "hover:border-accent-dim hover:bg-surface-2"
            }`}
          >
            <div className="mb-3 text-2xl" aria-hidden>
              {c.icon}
            </div>
            <h3 className="text-base font-semibold text-ink">{c.verb}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {c.promise}
            </p>
            {c.phase ? (
              <span className="mt-3 inline-block rounded-full border border-line-strong px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                {c.phase}
              </span>
            ) : (
              <span className="mt-3 inline-block text-xs font-medium text-accent-strong opacity-0 transition-opacity group-hover:opacity-100">
                paste a build to start →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
