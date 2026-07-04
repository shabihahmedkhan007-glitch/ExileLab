# WORKFLOW — The Official Development Lifecycle

Every feature and every non-trivial change in ExileLab follows this lifecycle. It supersedes the shorter pipeline previously described in README.md and rfcs/README.md (those now defer to this document).

```
Idea
 ↓
Discussion
 ↓
Research
 ↓
RFC
 ↓
Review
 ↓
Documentation
 ↓
Prototype
 ↓
Implementation
 ↓
Testing
 ↓
Git Commit
 ↓
Update PROJECT_CONTEXT.md
```

## The stages

1. **Idea** — anything: a feature, a fix, a "what if". Ideas are free; capture them (an `rfcs/` draft stub or a note in PROJECT_CONTEXT.md's Open Tasks) rather than acting on them immediately.
2. **Discussion** — talk it through: does it align with VISION.md and PRINCIPLES.md? Is it in the current milestone's scope? Many ideas correctly die here.
3. **Research** — collect facts in `research/` (APIs, competitor behavior, algorithms, performance data). Research never defines product behavior (see research/README.md).
4. **RFC** — write the proposal in `rfcs/` as `NNNN-short-title.md` (see rfcs/README.md for the skeleton). Must include compliance, vision, and principles checks plus a "Documentation impact" section.
5. **Review** — the RFC is reviewed and marked Accepted or Rejected. Rejected RFCs are kept forever with the reason.
6. **Documentation** — an accepted RFC's changes are applied to the owning `docs/` files (all affected docs together, in one pass). Architectural decisions get an ADR appended to DECISIONS.md; new terms go to GLOSSARY.md. **Documentation lands before code.**
7. **Prototype** — a spike or thin vertical slice proving the risky assumption (see PRODUCT_PLAN Phase 0 for the pattern). Prototypes are throwaway; their findings go to `research/` or the RFC.
8. **Implementation** — build the real thing, small iterative steps, matching the documented design.
9. **Testing** — per the testing table in PRODUCT_PLAN.md (unit, golden orderings, conformance, integration). A behavioral change without a test is incomplete.
10. **Git Commit** — atomic, with a message explaining what changed and why.
11. **Update PROJECT_CONTEXT.md** — record what moved: phase/milestone status, completed work, next recommended task.

**Proportionality:** trivial mechanical changes (typo, broken link, formatting) may skip stages 3–7 — but never stages 10–11, and never for anything that changes behavior, requirements, or architecture. When unsure whether something is trivial, it isn't.

## Session rules

**Every new session begins by reading:**
1. `CLAUDE.md` (the operating rulebook — session protocol, read order, document ownership)
2. `docs/PROJECT_CONTEXT.md` (current status)
3. The documents its read order points to for today's task.

**Then, before any changes, the assistant explains:**
- Current project state
- Current milestone
- Today's objective
- Which document owns today's work

**…and waits for approval before making changes.**

If the user types only "Continue.", the objective is PROJECT_CONTEXT.md → *Next Recommended Task*.

## Document ownership

- Every change first determines its owning document (ownership map in CLAUDE.md).
- If multiple documents are affected, they are updated **together in the same pass**.
- Documentation must never be internally inconsistent. If code and docs disagree, one of them is wrong — fix the contradiction before proceeding.

## Persistent memory policy

- The **repository is the single source of truth**. All long-term project knowledge lives in these documents.
- Assistant persistent memory stays minimal: at most stable pointers (where the repo lives, that this protocol exists). No workflow rules, no teaching preferences, no project status in memory — that is what PROJECT_CONTEXT.md is for.
- Long conversational handoffs are an anti-pattern: if the information matters beyond this session, it belongs in PROJECT_CONTEXT.md.

## Session completion

At the end of every meaningful work session:

1. **Update `docs/PROJECT_CONTEXT.md`** — phase, milestone, completed work, open tasks, risks, blockers, next recommended task, last-session summary, last-updated date.
2. **Recommend a git commit** (`git add .` + message, with a one-paragraph explanation).
3. **Summarize completed work** — briefly, in the session.
4. **List remaining tasks** — in PROJECT_CONTEXT.md, not as a chat wall.
5. **Recommend the next objective** — this becomes the next session's starting point.
