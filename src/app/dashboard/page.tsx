import { BusinessAnalyticsView, parseDays } from "@/features/analytics/components/BusinessAnalyticsView";
import { requireOwnedBusiness } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { session, businessId, businessName } = await requireOwnedBusiness();
  const days = parseDays((await searchParams).days);

  return (
    <AppShell
      navItems={[{ label: "Dashboard", href: "/dashboard", active: true }]}
      email={session.email}
      roleLabel="Business owner"
      title={businessName}
      subtitle="Your scan activity"
    >
      <BusinessAnalyticsView businessId={businessId} days={days} />
    </AppShell>
  );
}
