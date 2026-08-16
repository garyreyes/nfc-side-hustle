"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { isValidSlug } from "@/lib/slug";
import {
  assignPlateToBusiness,
  BusinessManagementError,
  createBranch,
  createBusiness,
  createBusinessOwner,
  createPlate,
  isSlugTaken,
  recordInventoryArrival,
  setPlateBranch,
  setPlateStatus,
  updatePlateCapability,
} from "./api";

// This action is gated by real per-user sessions (V4): src/proxy.ts only
// does an optimistic cookie-presence redirect for UX, it is NOT the
// security boundary — that's requirePlatformAdmin() below and inside
// each of createBusiness()/createPlate()/isSlugTaken() themselves
// (defense in depth). The explicit call here, before the try block, is
// deliberate and required, not redundant with those inner calls: if it
// were only checked inside createBusiness()/createPlate() (both called
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

// Unlike formField(), never trims — a leading/trailing space is part of
// the password as typed. See features/auth/actions.ts's passwordField()
// for the full reasoning (silently trimming here but not at login time
// would let an admin lock an owner out of their own account).
function passwordField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createBusinessAction(formData: FormData) {
  await requirePlatformAdmin();

  const name = formField(formData, "name");
  const googleReviewUrl = formField(formData, "googleReviewUrl");
  const slug = formField(formData, "slug");
  const ownerEmail = formField(formData, "ownerEmail");
  const ownerPassword = passwordField(formData, "ownerPassword");

  // Validate and check slug availability before creating the business
  // row. Without this, an ordinary typo (duplicate or malformed slug) —
  // ordinary admin usage, not a rare failure — would leave a permanent
  // orphan business with no plate, since V2 has no delete/update yet.
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

  // Owner fields are optional, but only together — half-set owner info
  // would either silently create a password-less account or silently
  // drop a typed email.
  if ((ownerEmail && !ownerPassword) || (!ownerEmail && ownerPassword)) {
    redirect(
      `/admin/businesses?error=${encodeURIComponent(
        "Owner email and password must both be provided, or both left blank."
      )}`
    );
  }

  try {
    const business = await createBusiness({ name, googleReviewUrl });
    await createPlate({ businessId: business.id, slug });
    if (ownerEmail && ownerPassword) {
      await createBusinessOwner({ businessId: business.id, email: ownerEmail, password: ownerPassword });
    }
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("createBusinessAction: unexpected error", err);
    redirect(`/admin/businesses?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/businesses");
}

// businessId is bound via .bind() from the page (see admin/businesses/
// page.tsx), not read from formData — Next.js encrypts bound Server
// Action arguments, so it can't be tampered with via the submitted form
// the way a hidden input could be.
export async function addBusinessOwnerAction(businessId: string, formData: FormData) {
  await requirePlatformAdmin();

  const email = formField(formData, "email");
  const password = passwordField(formData, "password");

  if (!email || !password) {
    redirect(`/admin/businesses?error=${encodeURIComponent("Owner email and password are required.")}`);
  }

  try {
    await createBusinessOwner({ businessId, email, password });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("addBusinessOwnerAction: unexpected error", err);
    redirect(`/admin/businesses?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/businesses");
}

// businessId is bound via .bind() from the page, same reasoning as
// addBusinessOwnerAction above.
export async function createBranchAction(businessId: string, formData: FormData) {
  await requirePlatformAdmin();

  const name = formField(formData, "name");
  const googleReviewUrl = formField(formData, "googleReviewUrl");

  try {
    await createBranch({ businessId, name, googleReviewUrl });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("createBranchAction: unexpected error", err);
    redirect(`/admin/businesses?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/businesses");
}

// businessId is bound via .bind() from the page, same reasoning as
// addBusinessOwnerAction above. Unlike createBusinessAction, no
// isSlugTaken() pre-check is needed here — a duplicate/malformed slug
// here doesn't risk orphaning anything (this only ever inserts a single
// plate row, never a business), so createPlate()'s own validation and
// unique-constraint handling is sufficient.
export async function createPlateAction(businessId: string, formData: FormData) {
  await requirePlatformAdmin();

  const slug = formField(formData, "slug");
  const branchId = formField(formData, "branchId");

  try {
    await createPlate({ businessId, slug, branchId: branchId || undefined });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("createPlateAction: unexpected error", err);
    redirect(`/admin/businesses?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/businesses");
}

// plateId is bound via .bind() from /admin/plates, same reasoning as
// addBusinessOwnerAction above.
export async function assignPlateAction(plateId: string, formData: FormData) {
  await requirePlatformAdmin();

  const businessId = formField(formData, "businessId");
  if (!businessId) {
    redirect(`/admin/plates?error=${encodeURIComponent("Choose a business to assign this plate to.")}`);
  }

  try {
    await assignPlateToBusiness({ plateId, businessId });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("assignPlateAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

export async function setPlateBranchAction(plateId: string, formData: FormData) {
  await requirePlatformAdmin();

  const branchId = formField(formData, "branchId");

  try {
    await setPlateBranch({ plateId, branchId: branchId || null });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("setPlateBranchAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

export async function updatePlateCapabilityAction(plateId: string, formData: FormData) {
  await requirePlatformAdmin();

  const capability = formField(formData, "capability");
  if (capability !== "qr" && capability !== "nfc" && capability !== "combo") {
    redirect(`/admin/plates?error=${encodeURIComponent("Invalid capability.")}`);
  }

  try {
    await updatePlateCapability({ plateId, capability });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("updatePlateCapabilityAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

// plateId and the target status are both bound via .bind() from the
// page — a single-click toggle, no user-entered fields, so formData
// itself is unused but still required as the last parameter for a
// Server Action wired to a <form action={...}>.
export async function setPlateStatusAction(
  plateId: string,
  status: "active" | "suspended",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required last param for a Server Action bound to a <form>, not read
  _formData: FormData
) {
  await requirePlatformAdmin();

  try {
    await setPlateStatus({ plateId, status });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("setPlateStatusAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

export async function recordInventoryArrivalAction(formData: FormData) {
  await requirePlatformAdmin();

  const batchName = formField(formData, "batchName");
  const capability = formField(formData, "capability");
  const quantityRaw = formField(formData, "quantity");
  const unitCostRaw = formField(formData, "unitCost");

  if (capability !== "qr" && capability !== "nfc" && capability !== "combo") {
    redirect(`/admin/inventory?error=${encodeURIComponent("Invalid capability.")}`);
  }

  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity)) {
    redirect(`/admin/inventory?error=${encodeURIComponent("Quantity must be a whole number.")}`);
  }

  // Entered in whole currency units (e.g. pesos) for a human filling out
  // a form, converted to centavos (the schema's storage unit) here —
  // Math.round guards against a value like "12.345" producing a
  // fractional centavo from floating-point input.
  const unitCostMajor = Number(unitCostRaw);
  if (!Number.isFinite(unitCostMajor)) {
    redirect(`/admin/inventory?error=${encodeURIComponent("Unit cost must be a number.")}`);
  }
  const unitCostCents = Math.round(unitCostMajor * 100);

  try {
    await recordInventoryArrival({ batchName, capability, quantity, unitCostCents });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/inventory?error=${encodeURIComponent(err.message)}`);
    }
    console.error("recordInventoryArrivalAction: unexpected error", err);
    redirect(`/admin/inventory?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/inventory");
}
