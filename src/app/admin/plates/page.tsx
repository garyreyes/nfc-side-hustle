import {
  assignNextUnassignedPlateAction,
  setPlateBranchAction,
  setPlateStatusAction,
  updateGroupCapabilityAction,
  updatePlateCapabilityAction,
} from "@/features/business-management/actions";
import { listBusinesses, listPlates, type PlateListItem } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";
import { Badge } from "@/shared/ui/Badge";
import formStyles from "@/shared/ui/form.module.css";
import { StatCard } from "@/shared/ui/StatCard";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import styles from "./page.module.css";

const STATUS_FILTERS = ["all", "unassigned", "active", "suspended"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return (STATUS_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as StatusFilter) : "all";
}

function badgeTone(status: PlateListItem["status"]): "neutral" | "accent" | "danger" {
  if (status === "active") return "accent";
  if (status === "suspended") return "danger";
  return "neutral";
}

// Unassigned plates within one batch+capability are interchangeable —
// nobody has ever needed to pick WHICH generic pre-sale unit goes to a
// given business, only how many are left. So instead of one card per
// unassigned plate (unreadable once a batch is 100+ units), they're
// collapsed into one summary row per group; only plates that actually
// belong to a business (meaningfully distinct from each other) still get
// their own card.
type UnassignedGroup = {
  key: string;
  batchId: string | null;
  batchName: string | null;
  capability: PlateListItem["capability"];
  count: number;
};

function groupUnassigned(plates: PlateListItem[]): UnassignedGroup[] {
  const groups: UnassignedGroup[] = [];
  const byKey = new Map<string, UnassignedGroup>();
  for (const plate of plates) {
    if (plate.status !== "unassigned") continue;
    const key = `${plate.batchId ?? "none"}::${plate.capability}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const group: UnassignedGroup = {
      key,
      batchId: plate.batchId,
      batchName: plate.batchName,
      capability: plate.capability,
      count: 1,
    };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

export default async function AdminPlatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const session = await requirePlatformAdmin();

  const { status: statusParam, error } = await searchParams;
  const statusFilter = parseStatusFilter(statusParam);

  const [allPlates, businesses] = await Promise.all([listPlates(), listBusinesses()]);

  const counts = {
    all: allPlates.length,
    unassigned: allPlates.filter((p) => p.status === "unassigned").length,
    active: allPlates.filter((p) => p.status === "active").length,
    suspended: allPlates.filter((p) => p.status === "suspended").length,
  };

  const visiblePlates =
    statusFilter === "all" ? allPlates : allPlates.filter((p) => p.status === statusFilter);

  const unassignedGroups = groupUnassigned(visiblePlates);
  const individualPlates = visiblePlates.filter((p) => p.status !== "unassigned");

  const branchesByBusiness = new Map(businesses.map((b) => [b.businessId, b.branches]));

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: false },
        { label: "Dashboard", href: "/admin/dashboard", active: false },
        { label: "Plates", href: "/admin/plates", active: true },
        { label: "Inventory", href: "/admin/inventory", active: false },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Plates"
      subtitle={`${allPlates.length} plate${allPlates.length === 1 ? "" : "s"} across every business and batch.`}
    >
      {error && (
        <p className={formStyles.errorBanner} style={{ marginBottom: "var(--space-5)" }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Total plates" value={counts.all} />
        <StatCard label="Unassigned" value={counts.unassigned} />
        <StatCard label="Active" value={counts.active} />
        <StatCard label="Suspended" value={counts.suspended} />
      </div>

      <nav aria-label="Filter by status" className={styles.filterNav}>
        {STATUS_FILTERS.map((filter) => (
          <a
            key={filter}
            href={filter === "all" ? "/admin/plates" : `/admin/plates?status=${filter}`}
            aria-current={filter === statusFilter ? "true" : undefined}
            className={
              filter === statusFilter ? `${styles.filterLink} ${styles.filterLinkActive}` : styles.filterLink
            }
          >
            {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)} ({counts[filter]})
          </a>
        ))}
      </nav>

      {unassignedGroups.length === 0 && individualPlates.length === 0 ? (
        <p className={styles.plateMeta}>No plates match this filter.</p>
      ) : (
        <div className={styles.plateList}>
          {unassignedGroups.map((group) => (
            <div key={group.key} className={styles.plateCard}>
              <div className={styles.plateIdentity}>
                <span className={styles.plateSlug}>
                  {group.count} unassigned plate{group.count === 1 ? "" : "s"}
                </span>
                <span className={styles.badgeRow}>
                  <Badge tone="neutral">unassigned</Badge>
                  <Badge>{group.capability}</Badge>
                </span>
                <span className={styles.plateMeta}>
                  {group.batchName ? `Batch: ${group.batchName}` : "No batch"}
                </span>
              </div>

              <div className={styles.plateActions}>
                <div className={styles.actionGroup}>
                  <span className={styles.actionLabel}>Assign one to business</span>
                  <form
                    action={assignNextUnassignedPlateAction.bind(null, group.batchId, group.capability)}
                    className={styles.inlineForm}
                  >
                    <select className={formStyles.select} name="businessId" required defaultValue="">
                      <option value="" disabled>
                        Choose a business…
                      </option>
                      {businesses.map((b) => (
                        <option key={b.businessId} value={b.businessId}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={formStyles.input}
                      type="number"
                      name="sellPrice"
                      min="0"
                      step="0.01"
                      placeholder="Sale price (₱)"
                      aria-label="Sale price in pesos"
                      style={{ width: "9rem" }}
                    />
                    <SubmitButton
                      className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                      pendingLabel="Assigning…"
                    >
                      Assign
                    </SubmitButton>
                  </form>
                </div>

                <div className={styles.actionGroup}>
                  <span className={styles.actionLabel}>Fix capability for all {group.count}</span>
                  <form
                    action={updateGroupCapabilityAction.bind(null, group.batchId, group.capability)}
                    className={styles.inlineForm}
                  >
                    <select className={formStyles.select} name="capability" defaultValue={group.capability}>
                      <option value="qr">QR</option>
                      <option value="nfc">NFC</option>
                      <option value="combo">Combo</option>
                    </select>
                    <SubmitButton
                      className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                      pendingLabel="Saving…"
                    >
                      Save
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {individualPlates.map((plate) => {
            const businessBranches = plate.businessId ? branchesByBusiness.get(plate.businessId) ?? [] : [];

            return (
              <div key={plate.plateId} className={styles.plateCard}>
                <div className={styles.plateIdentity}>
                  <a href={`/r/${plate.slug}`} className={styles.plateSlug}>
                    /r/{plate.slug}
                  </a>
                  <span className={styles.badgeRow}>
                    <Badge tone={badgeTone(plate.status)}>{plate.status}</Badge>
                    <Badge>{plate.capability}</Badge>
                  </span>
                  <span className={styles.plateMeta}>
                    {plate.batchName ? `Batch: ${plate.batchName}` : "No batch"}
                  </span>
                </div>

                <div className={styles.plateActions}>
                  <div className={styles.actionGroup}>
                    <span className={styles.actionLabel}>Business</span>
                    <span className={styles.assignedLine}>{plate.businessName}</span>
                  </div>

                  <div className={styles.actionGroup}>
                    <span className={styles.actionLabel}>Branch</span>
                    <form
                      action={setPlateBranchAction.bind(null, plate.plateId)}
                      className={styles.inlineForm}
                    >
                      <select
                        className={formStyles.select}
                        name="branchId"
                        defaultValue={plate.branchId ?? ""}
                      >
                        <option value="">No branch</option>
                        {businessBranches.map((branch) => (
                          <option key={branch.branchId} value={branch.branchId}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                        pendingLabel="Saving…"
                      >
                        Save
                      </SubmitButton>
                    </form>
                  </div>

                  <div className={styles.actionGroup}>
                    <span className={styles.actionLabel}>Status</span>
                    <form
                      action={setPlateStatusAction.bind(
                        null,
                        plate.plateId,
                        plate.status === "active" ? "suspended" : "active"
                      )}
                    >
                      <SubmitButton
                        className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                        pendingLabel="Saving…"
                      >
                        {plate.status === "active" ? "Suspend" : "Reactivate"}
                      </SubmitButton>
                    </form>
                  </div>

                  <div className={styles.actionGroup}>
                    <span className={styles.actionLabel}>Capability</span>
                    <form
                      action={updatePlateCapabilityAction.bind(null, plate.plateId)}
                      className={styles.inlineForm}
                    >
                      <select className={formStyles.select} name="capability" defaultValue={plate.capability}>
                        <option value="qr">QR</option>
                        <option value="nfc">NFC</option>
                        <option value="combo">Combo</option>
                      </select>
                      <SubmitButton
                        className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                        pendingLabel="Saving…"
                      >
                        Save
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
