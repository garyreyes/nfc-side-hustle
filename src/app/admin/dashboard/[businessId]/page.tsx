import Link from "next/link";
import { BusinessAnalyticsView, parseDays } from "@/features/analytics/components/BusinessAnalyticsView";
import { requirePlatformAdmin } from "@/lib/auth/dal";

// Not strictly required (a dynamic route segment with no
// generateStaticParams is already rendered on-demand), but kept explicit
// after 3b's build silently static-prerendered a sibling page with no
// dynamic signal — see PROJECT_FACTS.md.
export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requirePlatformAdmin();

  const { businessId } = await params;
  const days = parseDays((await searchParams).days);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <p>
        {/* Link, not a plain <a>, only because of an ESLint rule quirk:
            the regex no-html-link-for-pages generates for the sibling
            dynamic route /admin/dashboard/[businessId] also matches the
            empty-segment case /admin/dashboard/, false-positiving on a
            literal href here. Every other internal admin link in this
            codebase intentionally stays a plain <a>. */}
        <Link href="/admin/dashboard">Back to dashboard</Link>
      </p>
      <h1>Scan activity</h1>

      <BusinessAnalyticsView businessId={businessId} days={days} />
    </main>
  );
}
