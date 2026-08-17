"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { createPlatformAdmin, TeamManagementError } from "./api";

// requirePlatformAdmin() is called here, before the try block, for the
// same reason documented in business-management/actions.ts: redirect()
// thrown from inside createPlatformAdmin() (called within the try below)
// would otherwise be caught by the generic catch as if it were an
// ordinary error, turning "please log back in" into a misleading
// "Something went wrong."
export async function createPlatformAdminAction(formData: FormData) {
  await requirePlatformAdmin();

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  // Never trimmed, same reasoning as features/auth/actions.ts's
  // passwordField() — a leading/trailing space is part of the password
  // as typed, and silently trimming here (but not at login time) would
  // let an admin lock a teammate out of their own new account.
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!email || !password) {
    redirect(`/admin/team?error=${encodeURIComponent("Email and password are both required.")}`);
  }

  try {
    await createPlatformAdmin({ email, password });
  } catch (err) {
    if (err instanceof TeamManagementError) {
      redirect(`/admin/team?error=${encodeURIComponent(err.message)}`);
    }
    console.error("createPlatformAdminAction: unexpected error", err);
    redirect(`/admin/team?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/team");
}
