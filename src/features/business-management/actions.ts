"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { isValidSlug } from "@/lib/slug";
import { BusinessManagementError, createBusiness, createCard, isSlugTaken } from "./api";

// This action is gated by real per-user sessions (V4): src/proxy.ts only
// does an optimistic cookie-presence redirect for UX, it is NOT the
// security boundary — that's requirePlatformAdmin() below and inside
// each of createBusiness()/createCard()/isSlugTaken() themselves
// (defense in depth). The explicit call here, before the try block, is
// deliberate and required, not redundant with those inner calls: if it
// were only checked inside createBusiness()/createCard() (both called
// from within the try below), requirePlatformAdmin()'s redirect() would
// throw *inside* that try and get caught by the generic catch as if it
// were an ordinary error — silently turning "please log back in" into a
// misleading "Something went wrong" on the wrong page. Any future
// Server Action that calls a requirePlatformAdmin()-guarded api.ts
// function from inside a try/catch must check auth explicitly first,
// outside that try, for the same reason.

function formField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createBusinessAction(formData: FormData) {
  await requirePlatformAdmin();

  const name = formField(formData, "name");
  const googleReviewUrl = formField(formData, "googleReviewUrl");
  const slug = formField(formData, "slug");

  // Validate and check slug availability before creating the business
  // row. Without this, an ordinary typo (duplicate or malformed slug) —
  // ordinary admin usage, not a rare failure — would leave a permanent
  // orphan business with no card, since V2 has no delete/update yet.
  if (!isValidSlug(slug)) {
    redirect(
      `/admin/businesses?error=${encodeURIComponent(
        "Slug must contain only lowercase letters, numbers, and hyphens."
      )}`
    );
  }
  if (await isSlugTaken(slug)) {
    redirect(`/admin/businesses?error=${encodeURIComponent(`Slug "${slug}" is already in use.`)}`);
  }

  try {
    const business = await createBusiness({ name, googleReviewUrl });
    await createCard({ businessId: business.id, slug });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("createBusinessAction: unexpected error", err);
    redirect(`/admin/businesses?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/businesses");
}
