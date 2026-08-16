import { loginAction, logoutAction } from "@/features/auth/actions";
import { verifySession } from "@/lib/auth/dal";
import formStyles from "@/shared/ui/form.module.css";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Platform admin",
  business_owner: "Business owner",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.mark} aria-hidden="true">
          R
        </span>

        {session ? (
          <>
            <div className={styles.identityCard}>
              <span className={styles.identityEmail}>{session.email}</span>
              <span className={styles.identityRole}>
                {ROLE_LABEL[session.role] ?? session.role}
              </span>
            </div>
            <a
              href={session.role === "platform_admin" ? "/admin/businesses" : "/dashboard"}
              className={formStyles.button}
            >
              Go to {session.role === "platform_admin" ? "admin" : "your dashboard"}
            </a>
            <form action={logoutAction}>
              <SubmitButton className={formStyles.buttonSecondary} pendingLabel="Logging out…">
                Log out
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <div className={styles.heading}>
              <h1 className={styles.title}>Log in</h1>
              <p className={styles.subtitle}>Manage your review plates and scan activity.</p>
            </div>

            {error && <p className={formStyles.errorBanner}>{error}</p>}

            <form action={loginAction} className={formStyles.form}>
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
                <input
                  className={formStyles.input}
                  id="password"
                  type="password"
                  name="password"
                  required
                />
              </div>
              <SubmitButton className={formStyles.button} pendingLabel="Logging in…">
                Log in
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
