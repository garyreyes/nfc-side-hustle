import type { ReactNode } from "react";
import { logoutAction } from "@/features/auth/actions";
import styles from "./AppShell.module.css";
import { SubmitButton } from "./SubmitButton";

export type NavItem = {
  label: string;
  href: string;
  active: boolean;
};

export function AppShell({
  navItems,
  email,
  roleLabel,
  title,
  subtitle,
  actions,
  children,
}: {
  navItems: NavItem[];
  email: string;
  roleLabel: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            R
          </span>
          <span className={styles.brandLabel}>Reviews</span>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={item.active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              aria-current={item.active ? "page" : undefined}
            >
              <span className={styles.navDot} aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.identity}>
            <span className={styles.identityEmail}>{email}</span>
            <span className={styles.identityRole}>{roleLabel}</span>
          </div>
          <form action={logoutAction}>
            <SubmitButton className={styles.logoutButton} pendingLabel="Logging out…">
              Log out
            </SubmitButton>
          </form>
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>{title}</h1>
              {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
