import { logoutAction } from "@/features/auth/actions";
import { BusinessAnalyticsView, parseDays } from "@/features/analytics/components/BusinessAnalyticsView";
import { requireOwnedBusiness } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { session, businessId, businessName } = await requireOwnedBusiness();
  const days = parseDays((await searchParams).days);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <p>
        Logged in as <strong>{session.email}</strong>
      </p>
      <h1>{businessName}</h1>

      <BusinessAnalyticsView businessId={businessId} days={days} />

      <form action={logoutAction} style={{ marginTop: 24 }}>
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
