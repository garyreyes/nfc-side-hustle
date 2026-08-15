"use server";

import { redirect } from "next/navigation";
import { isValidSlug } from "@/lib/slug";
import { BusinessManagementError, createBusiness, createCard, isSlugTaken } from "./api";

// This action is only ever meant to be invoked from a page under
// /admin/*, which src/proxy.ts gates with Basic Auth — verified that the
// proxy's path-based matcher blocks this action's underlying POST the
// same way it blocks a GET. It has no auth check of its own, so if this
// is ever imported into a route outside /admin/*, it becomes an
// unauthenticated write endpoint. Don't do that without adding an
// explicit check here first.

function formField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createBusinessAction(formData: FormData) {
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
