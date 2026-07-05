// /legal/privacy — Privacy Policy PLACEHOLDER. Marked DRAFT pending attorney
// review (PRD §7.4 item 6). Skeleton sections; the load-bearing commitments —
// imported character data handling, account data, and NEVER POESESSID — are
// stated plainly so they survive into the final policy.

import type { Metadata } from "next";
import { LegalDoc, LegalSection } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy (draft) — ExileLab",
  description:
    "Draft privacy policy — placeholder scaffolding pending attorney review (PRD §7.4).",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="2026-07-05" draft>
      <LegalSection heading="1. Imported character data">
        <p>
          When you paste or import a build, we process the build data — passive
          tree, gear, skills, and configuration — to normalize it, measure it,
          and score it. This data is the input to your results and is retained
          only as long as needed to provide them; the raw payload you imported is
          held on a short, time-boxed retention window for re-normalization and
          debugging, then discarded.
        </p>
        <p>
          Imported build data contains no real-world personal identity. We do not
          sell it, and we do not share it except as needed to render the results
          and attribution you asked for.
        </p>
      </LegalSection>

      <LegalSection heading="2. We never touch your POESESSID">
        <p className="rounded-[var(--radius)] border border-line-strong bg-surface-2 px-4 py-3 text-ink">
          We never ask for, never accept, and never store your POESESSID, account
          password, or any session credential — ever. Any account linking, when
          it ships, will use official OAuth only. This is a hard, permanent
          commitment of the platform.
        </p>
      </LegalSection>

      <LegalSection heading="3. Account data">
        <p>
          Accounts are optional. When you create one, we store the minimum needed
          to operate it — an account identifier and your saved builds. Today,
          accounts are an anonymous seam with no login yet; real authentication
          will replace it before any personal data is collected, and this policy
          will be updated to describe exactly what is stored and why.
        </p>
      </LegalSection>

      <LegalSection heading="4. Cookies and analytics">
        <p>
          Placeholder. Any cookies or privacy-respecting analytics used will be
          enumerated here, with their purpose and retention, before launch.
        </p>
      </LegalSection>

      <LegalSection heading="5. Third-party sources">
        <p>
          Attributed public build sources are governed by their own privacy
          practices. ExileLab links to them; it does not fetch your data from
          them on your behalf without your action.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your choices and contact">
        <p>
          Placeholder — data access, correction, and deletion mechanisms, plus a
          contact address, to be specified by counsel before launch.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
