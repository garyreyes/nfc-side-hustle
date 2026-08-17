import { createPlatformAdminAction } from "@/features/team-management/actions";
import { listPlatformAdmins } from "@/features/team-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";
import { Card } from "@/shared/ui/Card";
import formStyles from "@/shared/ui/form.module.css";
import { StatCard } from "@/shared/ui/StatCard";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import tableStyles from "@/shared/ui/table.module.css";
import styles from "./page.module.css";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { error } = await searchParams;

  const admins = await listPlatformAdmins();

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: false },
        { label: "Dashboard", href: "/admin/dashboard", active: false },
        { label: "Plates", href: "/admin/plates", active: false },
        { label: "Inventory", href: "/admin/inventory", active: false },
        { label: "Team", href: "/admin/team", active: true },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Team"
      subtitle="Everyone with platform-admin access — not visible to businesses or their owners."
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
        <StatCard label="Admins" value={admins.length} />
      </div>

      <Card title="Add an admin">
        <form action={createPlatformAdminAction} className={formStyles.form}>
          <div className={formStyles.formRow}>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="email">
                Email
              </label>
              <input className={formStyles.input} id="email" type="email" name="email" required />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="password">
                Password
              </label>
              <input className={formStyles.input} id="password" type="password" name="password" required />
            </div>
          </div>
          <p className={formStyles.helperText}>
            Gets full platform-admin access — the same as your own login. No email is sent; share the
            password with them directly.
          </p>
          <SubmitButton className={formStyles.button} pendingLabel="Adding…">
            Add admin
          </SubmitButton>
        </form>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <div className={styles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Added</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.userId}>
                <td>{admin.email}</td>
                <td>{formatDate(admin.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
