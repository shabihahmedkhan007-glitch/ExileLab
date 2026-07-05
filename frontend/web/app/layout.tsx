import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "ExileLab — tune your build to what you want",
  description:
    "A personalized Path of Exile 2 build optimizer. Import a build, measure it with a deterministic engine, and rank changes by YOUR priorities — never max-DPS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-bold text-white"
              >
                E
              </span>
              <span className="font-serif text-lg tracking-tight text-ink">
                ExileLab
              </span>
            </Link>
            <span className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-[11px] text-faint">
              deterministic engine · no AI in the math
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
