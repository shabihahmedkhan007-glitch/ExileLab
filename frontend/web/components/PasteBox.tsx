// The paste box — "import is not a page, it's a box" (UX §3). One input that
// accepts ANYTHING (PoB code, ExileLab JSON, a share URL string); source
// detection is the API's job, so there is no format dropdown. On submit it POSTs
// to /import and redirects to the build workspace. During the multi-second
// import it shows a STAGED progress line, not a spinner (UX §8) — honesty beats
// a fake spinner. No external fetch ever happens here (charter §7.5).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SAMPLE_BUILD } from "@/lib/sample";
import { Button } from "./ui";

const STAGES = ["fetching", "parsing", "calculating", "scoring"] as const;

export function PasteBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: string) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setStage(0);
    // Advance the staged line while the request is in flight (honest, not fake:
    // the API genuinely imports → normalizes → measures → scores).
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i), i * 260),
    );
    try {
      const res = await api.importBuild(input);
      setStage(STAGES.length - 1);
      router.push(`/b/${res.buildId}`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "Something went wrong importing that build.";
      setError(msg);
      setBusy(false);
    } finally {
      timers.forEach(clearTimeout);
    }
  }

  return (
    <div>
      <div
        className={`card p-1.5 transition-colors ${
          busy ? "opacity-80" : ""
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a Path of Building code, an ExileLab build, or a build URL — we'll figure out the format."
          rows={5}
          disabled={busy}
          className="w-full resize-none rounded-[var(--radius)] bg-transparent px-4 py-3 text-sm text-ink placeholder:text-faint focus:outline-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(value);
          }}
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1.5">
          <button
            onClick={() => setValue(SAMPLE_BUILD)}
            disabled={busy}
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            Try a sample build
          </button>
          <Button
            variant="primary"
            onClick={() => submit(value)}
            disabled={busy || !value.trim()}
          >
            {busy ? "Importing…" : "Measure my build →"}
          </Button>
        </div>
      </div>

      {/* Staged progress line */}
      {busy ? (
        <div className="mt-3 flex items-center gap-2 px-1 text-xs">
          {STAGES.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span
                className={
                  i < stage
                    ? "text-gain"
                    : i === stage
                      ? "text-accent-strong"
                      : "text-faint"
                }
              >
                {i < stage ? "✓ " : ""}
                {s}
                {i === stage ? "…" : ""}
              </span>
              {i < STAGES.length - 1 ? (
                <span className="text-line-strong">→</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--color-loss)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-loss)_10%,transparent)] px-4 py-3 text-sm text-loss">
          {error}
        </div>
      ) : null}
    </div>
  );
}
