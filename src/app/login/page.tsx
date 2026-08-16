import { loginAction, logoutAction } from "@/features/auth/actions";
import { verifySession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: 24 }}>
      <h1>Log in</h1>

      {session ? (
        <div>
          <p>
            Logged in as <strong>{session.email}</strong> ({session.role})
          </p>
          <p>
            <a href={session.role === "platform_admin" ? "/admin/businesses" : "/dashboard"}>
              Go to {session.role === "platform_admin" ? "admin" : "your dashboard"}
            </a>
          </p>
          <form action={logoutAction}>
            <button type="submit">Log out</button>
          </form>
        </div>
      ) : (
        <>
          {error && (
            <p style={{ color: "#b00020", border: "1px solid #b00020", padding: 8 }}>{error}</p>
          )}
          <form action={loginAction} style={{ display: "grid", gap: 8 }}>
            <label>
              Email
              <br />
              <input type="email" name="email" required />
            </label>
            <label>
              Password
              <br />
              <input type="password" name="password" required />
            </label>
            <button type="submit">Log in</button>
          </form>
        </>
      )}
    </main>
  );
}
