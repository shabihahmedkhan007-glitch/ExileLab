// ItemTooltip — the canonical PoE item renderer (UX §5 #6). A dark panel with a
// rarity-colored header and monospaced modifier lines, matching the in-game
// tooltip dialect so a parsed item reads as itself. Rendering-only: every string
// here comes straight from the deterministic item parser (charter §7.5 — no
// external item lookup). Optional diff-highlight modes tint added/removed lines.

import type { ParsedItem } from "@/lib/types";

// PoE rarity colors (the game's own dialect). Normalized to lowercase keys.
const NORMAL = { color: "#c8c8c8", label: "Normal" };
const RARITY: Record<string, { color: string; label: string }> = {
  normal: NORMAL,
  magic: { color: "#8888ff", label: "Magic" },
  rare: { color: "#ffff77", label: "Rare" },
  unique: { color: "#af6025", label: "Unique" },
};

function rarityOf(rarity: string): { color: string; label: string } {
  return RARITY[rarity.toLowerCase()] ?? NORMAL;
}

export function ItemTooltip({
  item,
  highlight = "none",
}: {
  item: ParsedItem;
  /** Tint every mod line: none, all-added (green), or all-removed (red). */
  highlight?: "none" | "added" | "removed";
}) {
  const r = rarityOf(item.rarity);
  const modColor =
    highlight === "added"
      ? "var(--color-gain)"
      : highlight === "removed"
        ? "var(--color-loss)"
        : "var(--color-muted)";
  const prefix = highlight === "added" ? "+ " : highlight === "removed" ? "− " : "";

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border bg-[#0b0c11] text-sm"
      style={{ borderColor: `color-mix(in oklab, ${r.color} 45%, #23262f)` }}
    >
      {/* Rarity-colored header */}
      <div
        className="px-4 py-2.5 text-center"
        style={{
          background: `color-mix(in oklab, ${r.color} 14%, transparent)`,
          borderBottom: `1px solid color-mix(in oklab, ${r.color} 35%, transparent)`,
        }}
      >
        <div
          className="font-serif text-base leading-tight tracking-tight"
          style={{ color: r.color }}
        >
          {item.name}
        </div>
        <div
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: `color-mix(in oklab, ${r.color} 70%, var(--color-muted))` }}
        >
          {r.label} · {item.slot}
        </div>
      </div>

      {/* Modifier lines */}
      <div className="flex flex-col gap-1 px-4 py-3">
        {item.modifiers.length === 0 ? (
          <span className="text-xs text-faint">No modifier lines parsed.</span>
        ) : (
          item.modifiers.map((line, i) => (
            <span
              key={i}
              className="tabular text-[13px] leading-snug"
              style={{ color: modColor }}
            >
              {prefix}
              {line}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
