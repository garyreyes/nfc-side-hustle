"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { verifyCredentials, type AuthenticatedUser } from "./api";

function formField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Unlike formField(), never trims — a leading/trailing space is part of
// the password a user actually typed. Silently stripping it here would
// only be safe if every future password-setting code path did the same
// trim before hashing; if any of them didn't, a password containing
// whitespace would hash one way and verify another, permanently locking
// that account out.
function passwordField(formData: FormData): string {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

export async function loginAction(formData: FormData) {
  const ip = getClientIp(await headers());
  if (isRateLimited(ip)) {
    redirect(`/?error=${encodeURIComponent("Too many attempts. Try again in a minute.")}`);
  }

  const email = formField(formData, "email");
  const password = passwordField(formData);

  let user: AuthenticatedUser | null;
  try {
    user = await verifyCredentials(email, password);
  } catch (err) {
    console.error("loginAction: unexpected error verifying credentials", err);
    redirect(`/?error=${encodeURIComponent("Something went wrong.")}`);
  }

  if (!user) {
    // Deliberately logs the attempted email (never the password) for a
    // basic audit trail on failed logins — per ARCHITECTURE.md § V4's
    // security baseline.
    console.error(`loginAction: failed login attempt for "${email}" at ${new Date().toISOString()}`);
    redirect(`/?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  try {
    await createSession(user.id);
  } catch (err) {
    console.error("loginAction: unexpected error creating session", err);
    redirect(`/?error=${encodeURIComponent("Something went wrong.")}`);
  }

  // Straight to the right dashboard, not back to the login page — the
  // whole point of this redirect is that a successful login shouldn't
  // require an extra manual click to get anywhere useful.
  redirect(user.role === "platform_admin" ? "/admin/businesses" : "/dashboard");
}

// POST only, never a GET link — a prefetched <Link> to a GET /logout
// would silently log users out via Next's own route prefetching.
export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
