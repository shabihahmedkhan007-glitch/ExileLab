// Budget guard (trust contract item 5: "budgets are enforced app-side").
//
// A minimal injectable seam: `tryConsume()` returns false when the budget is
// exhausted, and the Coach degrades (returns null, no provider call). The default
// is a per-process daily counter that resets at UTC midnight. Real deployments
// swap in a Redis-backed per-user daily budget behind this same interface
// (PRD §9.2: "per-user daily budgets enforced app-side").

/** Injectable budget seam. `tryConsume` reserves one unit or reports exhaustion. */
export interface BudgetGuard {
  /** Attempt to consume one narration unit. Returns false when exhausted. */
  tryConsume(): boolean;
}

/** A per-process daily-count budget that resets each UTC day. */
export class DailyBudgetGuard implements BudgetGuard {
  private day: string;
  private used = 0;

  constructor(
    /** Max narrations per UTC day (default generous; tune per deployment). */
    private readonly dailyLimit = 5_000,
    /** Injectable clock for deterministic tests. */
    private readonly now: () => Date = () => new Date(),
  ) {
    this.day = this.currentDay();
  }

  private currentDay(): string {
    return this.now().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  }

  tryConsume(): boolean {
    const today = this.currentDay();
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.dailyLimit) return false;
    this.used += 1;
    return true;
  }
}

/** A budget that always allows (useful for tests that never want to gate on budget). */
export class UnlimitedBudgetGuard implements BudgetGuard {
  tryConsume(): boolean {
    return true;
  }
}
