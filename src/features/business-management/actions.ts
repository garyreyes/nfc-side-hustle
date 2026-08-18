"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import {
  assignNextUnassignedPlate,
  BusinessManagementError,
  createBranch,
  createBusiness,
  createBusinessOwner,
  createPlate,
  deletePlate,
  recordInventoryArrival,
  setPlateBranch,
  setPlateStatus,
  unassignPlate,
  updateBusiness,
  updateCapabilityForUnassignedGroup,
  updatePlateCapability,
} from "./api";

// This action is gated by real per-user sessions (V4): src/proxy.ts only
// does an optimistic cookie-presence redirect for UX, it is NOT the
// security boundary — that's requirePlatformAdmin() below and inside
// each of createBusiness()/createBusinessOwner() themselves (defense in
// depth). The explicit call here, before the try block, is deliberate
// and required, not redundant with those inner calls: if it were only
// checked inside createBusiness() (called from within the try below),
// requirePlatformAdmin()'s redirect() would throw *inside* that try and
// get caught by the generic catch as if it were an ordinary error —
// silently turning "please log back in" into a misleading "Something
// went wrong" on the wrong page. Any future Server Action that calls a
// requirePlatformAdmin()-guarded api.ts function from inside a try/catch
// must check auth explicitly first, outside that try, for the same
// reason.

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
  // Optional — a business can be created with just a name (e.g. a quick
  // field sale where the real review link isn't known yet) and completed
  // later via updateBusinessAction.
  const googleReviewUrl = formField(formData, "googleReviewUrl");
  const contactName = formField(formData, "contactName");
  const contactEmail = formField(formData, "contactEmail");
  const notes = formField(formData, "notes");
  const ownerEmail = formField(formData, "ownerEmail");
  const ownerPassword = passwordField(formData, "ownerPassword");

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

  // No plate created here (unlike the original V1/V2 behavior) — real
  // plates now always come from Record Inventory Arrival + Assign
  // (/admin/inventory, /admin/plates), so a business starts with zero
  // plates rather than one automatic, untracked, ad-hoc one. Use the
  // "Add plate" form on this business's own card afterward for the rare
  // case a genuinely untracked one-off plate is still wanted.
  try {
    const business = await createBusiness({ name, googleReviewUrl, contactName, contactEmail, notes });
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

// businessId is bound via .bind() from the page, same reasoning as
// addBusinessOwnerAction below. Covers everything editable on a business
// after creation — name, review URL, and the reference-only contact
// fields — in one form rather than a separate action per field.
export async function updateBusinessAction(businessId: string, formData: FormData) {
  await requirePlatformAdmin();

  const name = formField(formData, "name");
  const googleReviewUrl = formField(formData, "googleReviewUrl");
  const contactName = formField(formData, "contactName");
  const contactEmail = formField(formData, "contactEmail");
  const notes = formField(formData, "notes");

  try {
    await updateBusiness({ businessId, name, googleReviewUrl, contactName, contactEmail, notes });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/businesses?error=${encodeURIComponent(err.message)}`);
    }
    console.error("updateBusinessAction: unexpected error", err);
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
// addBusinessOwnerAction above. This is the standalone, still-supported
// path for a genuinely untracked, ad-hoc plate not going through
// batch/inventory tracking — createBusinessAction no longer creates one
// automatically. No isSlugTaken() pre-check needed here — a duplicate/
// malformed slug doesn't risk orphaning anything (this only ever inserts
// a single plate row, never a business), so createPlate()'s own
// validation and unique-constraint handling is sufficient.
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
// batchId/capability are bound via .bind() from the grouped "Assign one"
// summary row (see admin/plates/page.tsx) — the caller picks a GROUP,
// not a specific plate, and the server chooses which interchangeable
// unassigned unit within it actually gets assigned.
export async function assignNextUnassignedPlateAction(
  batchId: string | null,
  capability: "qr" | "nfc" | "combo",
  formData: FormData
) {
  await requirePlatformAdmin();

  const businessId = formField(formData, "businessId");
  if (!businessId) {
    redirect(`/admin/plates?error=${encodeURIComponent("Choose a business to assign this plate to.")}`);
  }

  // Required (unlike unitCostCents at arrival time) — a sale with no
  // recorded price is exactly the gap that made /admin/inventory's
  // revenue figures unreliable, so the assign form is the one place this
  // now gets enforced rather than left to be filled in later.
  const sellPriceRaw = formField(formData, "sellPrice");
  if (!sellPriceRaw) {
    redirect(`/admin/plates?error=${encodeURIComponent("Sale price is required to assign a plate.")}`);
  }
  const sellPriceMajor = Number(sellPriceRaw);
  if (!Number.isFinite(sellPriceMajor) || sellPriceMajor < 0) {
    redirect(`/admin/plates?error=${encodeURIComponent("Sale price must be a non-negative number.")}`);
  }
  const sellPriceCents = Math.round(sellPriceMajor * 100);

  // Optional — picking a specific physical unit out of the group
  // instead of letting the system grab an arbitrary one. Needed for
  // pre-printed QR stock, where the slug is already fixed on the unit
  // in hand; irrelevant for NFC, where any unassigned chip works the
  // same since the address gets written afterward.
  const slug = formField(formData, "slug") || undefined;

  try {
    await assignNextUnassignedPlate({ batchId, capability, businessId, sellPriceCents, slug });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("assignNextUnassignedPlateAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

// batchId/fromCapability are bound via .bind() from the same grouped
// summary row — this bulk-fixes the capability for every still-unassigned
// plate in that group at once (e.g. correcting a batch recorded as QR
// when the physical units are actually NFC), since there's no individual
// unassigned plate row left for a per-plate editor to point at.
export async function updateGroupCapabilityAction(
  batchId: string | null,
  fromCapability: "qr" | "nfc" | "combo",
  formData: FormData
) {
  await requirePlatformAdmin();

  const toCapability = formField(formData, "capability");
  if (toCapability !== "qr" && toCapability !== "nfc" && toCapability !== "combo") {
    redirect(`/admin/plates?error=${encodeURIComponent("Invalid capability.")}`);
  }

  try {
    await updateCapabilityForUnassignedGroup({ batchId, fromCapability, toCapability });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("updateGroupCapabilityAction: unexpected error", err);
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

// plateId is bound via .bind() from /admin/plates, same reasoning as
// addBusinessOwnerAction above. Undoes a sale — the plate returns to
// unassigned inventory, reusable for a future sale — as opposed to
// deletePlateAction below, which removes the row entirely.
export async function unassignPlateAction(
  plateId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required last param for a Server Action bound to a <form>, not read
  _formData: FormData
) {
  await requirePlatformAdmin();

  try {
    await unassignPlate({ plateId });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("unassignPlateAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

// plateId is bound via .bind() from /admin/plates, same reasoning as
// addBusinessOwnerAction above. Permanently removes the plate row and
// its scan history — the page's confirm() prompt (see SubmitButton's
// confirmMessage) is the only guard here, since there's no undo once
// this runs.
export async function deletePlateAction(
  plateId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required last param for a Server Action bound to a <form>, not read
  _formData: FormData
) {
  await requirePlatformAdmin();

  try {
    await deletePlate({ plateId });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/plates?error=${encodeURIComponent(err.message)}`);
    }
    console.error("deletePlateAction: unexpected error", err);
    redirect(`/admin/plates?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/plates");
}

export async function recordInventoryArrivalAction(formData: FormData) {
  await requirePlatformAdmin();

  const batchName = formField(formData, "batchName");
  const capability = formField(formData, "capability");
  const unitCostRaw = formField(formData, "unitCost");

  if (capability !== "qr" && capability !== "nfc" && capability !== "combo") {
    redirect(`/admin/inventory?error=${encodeURIComponent("Invalid capability.")}`);
  }

  // Pre-made slugs (one per line) take priority over a typed quantity —
  // for stock whose QR was already fixed at manufacture time, quantity
  // is derived from how many slugs were pasted in, not typed separately,
  // so there's no redundant count for a human to get wrong. Leave this
  // blank for ordinary (e.g. NFC) arrivals and the quantity field is used
  // as before.
  const slugsRaw = formField(formData, "slugs");
  const slugs = slugsRaw
    ? slugsRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const quantityRaw = formField(formData, "quantity");
  const quantity = slugs.length > 0 ? slugs.length : Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    redirect(`/admin/inventory?error=${encodeURIComponent("Quantity must be a positive whole number.")}`);
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
    await recordInventoryArrival({
      batchName,
      capability,
      quantity,
      unitCostCents,
      slugs: slugs.length > 0 ? slugs : undefined,
    });
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      redirect(`/admin/inventory?error=${encodeURIComponent(err.message)}`);
    }
    console.error("recordInventoryArrivalAction: unexpected error", err);
    redirect(`/admin/inventory?error=${encodeURIComponent("Something went wrong.")}`);
  }

  redirect("/admin/inventory");
}
