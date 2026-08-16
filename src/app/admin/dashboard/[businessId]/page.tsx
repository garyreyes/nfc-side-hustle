import Link from "next/link";
import { BusinessAnalyticsView, parseDays } from "@/features/analytics/components/BusinessAnalyticsView";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";

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
  const session = await requirePlatformAdmin();

  const { businessId } = await params;
  const days = parseDays((await searchParams).days);

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: false },
        { label: "Dashboard", href: "/admin/dashboard", active: true },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Scan activity"
      actions={
        <Link
          href="/admin/dashboard"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}
        >
          ← Back to dashboard
        </Link>
      }
    >
      <BusinessAnalyticsView businessId={businessId} days={days} />
    </AppShell>
  );
}
