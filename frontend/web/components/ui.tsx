// Small shared chrome primitives: consistent radii, hover/focus on everything,
// one accent used sparingly. These carry the SaaS-chrome half of the visual
// language ("Linear wearing a Path of Exile ring").

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({
  variant = "outline",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";
  const variants: Record<string, string> = {
    primary:
      "bg-accent text-white hover:bg-accent-strong shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
    outline:
      "border border-line-strong text-ink bg-surface hover:bg-surface-2 hover:border-accent-dim",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-surface-2 ${className}`}
    />
  );
}

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line-strong bg-surface-2 text-muted",
    accent: "border-accent-dim bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)] text-accent-strong",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
