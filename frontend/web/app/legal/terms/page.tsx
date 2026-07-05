// /legal/terms — Terms of Service PLACEHOLDER. Marked DRAFT pending attorney
// review (PRD §7.4 item 6: "ToS/privacy policy covering imported character
// data"). Skeleton sections only; NOT the final terms.

import type { Metadata } from "next";
import { LegalDoc, LegalSection } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service (draft) — ExileLab",
  description:
    "Draft terms of service — placeholder scaffolding pending attorney review (PRD §7.4).",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="2026-07-05" draft>
      <LegalSection heading="1. What ExileLab is">
        <p>
          ExileLab is an independent build-optimization tool for Path of Exile 2.
          It imports build data you provide, measures it with a deterministic
          engine, and ranks changes against the priorities you choose. It is not
          affiliated with or endorsed by Grinding Gear Games.
        </p>
      </LegalSection>

      <LegalSection heading="2. Acceptable use">
        <p>
          You agree to use ExileLab only with build data you have the right to
          import, and not to abuse, overload, or attempt to circumvent the
          service. Automated scraping of the service is not permitted.
        </p>
      </LegalSection>

      <LegalSection heading="3. Imported character data">
        <p>
          You paste or import build data yourself. We process it to produce your
          results. See the Privacy Policy for how that data is handled and
          retained. We never ask for and never accept your POESESSID or any
          account password.
        </p>
      </LegalSection>

      <LegalSection heading="4. Accounts and subscriptions">
        <p>
          Placeholder. Free and paid tiers, billing, refunds, and cancellation
          terms will be specified here before launch.
        </p>
      </LegalSection>

      <LegalSection heading="5. Third-party sources and attribution">
        <p>
          Where a build originates from a public community source, it is
          attributed and linked. Those sources are governed by their own terms;
          ExileLab does not grant you any rights in third-party content.
        </p>
      </LegalSection>

      <LegalSection heading="6. No warranty; illustrative data">
        <p>
          Placeholder. ExileLab is provided &ldquo;as is.&rdquo; Prices shown are
          synthetic mock data until the real price layer ships and must not be
          relied upon. Optimization results are guidance, not guarantees.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of liability">
        <p>Placeholder — to be drafted by counsel.</p>
      </LegalSection>

      <LegalSection heading="8. Changes to these terms">
        <p>Placeholder — to be drafted by counsel.</p>
      </LegalSection>
    </LegalDoc>
  );
}
