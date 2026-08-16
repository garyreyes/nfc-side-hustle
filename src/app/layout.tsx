import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Review Card Dashboard",
  description: "QR/NFC review card management and scan analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={hankenGrotesk.variable}>
      <body>
        {/*
          THESIS: The clean sidebar-plus-card SaaS dashboard, executed at
          full craft rather than reinvented — the owner chose the category
          standard over two named cultural concepts (a market price-tag
          world and a receipt-ledger world) in an /impeccable new-work
          decision round.
          OWN-WORLD: White/light-gray ground (#f4f5f7), one restrained
          green accent (#157a53), rounded cards with a real offset+blur
          shadow, a white sidebar with a green active-nav state, Hanken
          Grotesk throughout, tabular numerals on every stat/count.
          STORY: A platform admin or a small-business owner opens the
          dashboard, immediately reads their scan numbers and card/branch
          list without friction, and trusts it enough to be a paid tool.
          FIRST VIEWPORT: A centered login card pre-auth; post-auth, a
          fixed sidebar (brand, nav, identity+logout) beside a content
          area whose header names the page and whose body leads with
          stat cards, then tables/chart.
          FORM: Canon / standing-exit path — craft bar: Oripio (the
          fintech-dashboard reference the owner shared twice).
          FINISH: unreviewed and undocumented is unfinished; this build
          ends with the finish review, the verdict, and DESIGN.md.
        */}
        {children}
      </body>
    </html>
  );
}
