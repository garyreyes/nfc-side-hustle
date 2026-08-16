import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "../src/lib/db/client";
import { batches, plates } from "../src/lib/db/schema";
import { generateUniqueSlugs } from "../src/lib/slug";

const DEFAULT_COUNT = 30;

const BASE_URL = process.env.QR_BASE_URL ?? "https://nfc-side-hustle.vercel.app";

type Capability = "qr" | "nfc" | "combo";
const CAPABILITY_MIXES: Record<string, Capability[]> = {
  even: ["qr", "nfc", "combo"],
  qr: ["qr"],
  nfc: ["nfc"],
  combo: ["combo"],
};

interface PlateSpec {
  serialId: string;
  capability: Capability;
  qrUrl: string | null;
  nfcPayload: string | null;
}

function buildPlateSpecs(count: number, mix: Capability[]): PlateSpec[] {
  const slugs = generateUniqueSlugs(count);
  return slugs.map((slug, i) => {
    const capability = mix[i % mix.length];
    const urlPath = `/r/${slug}`;
    return {
      serialId: slug,
      capability,
      qrUrl: capability !== "nfc" ? `${BASE_URL}${urlPath}?src=qr` : null,
      nfcPayload: capability !== "qr" ? `${BASE_URL}${urlPath}?src=nfc` : null,
    };
  });
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function writeManifest(outDir: string, plateSpecs: PlateSpec[]) {
  const header = "Serial_ID,Capability,Printed_Text,QR_Filename,QR_URL,NFC_Payload";
  const rows = plateSpecs.map((p) =>
    [
      p.serialId,
      p.capability,
      `ID: ${p.serialId.toUpperCase()}`,
      p.qrUrl ? `${p.serialId}.png` : "",
      p.qrUrl ?? "",
      p.nfcPayload ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );
  await writeFile(path.join(outDir, "manifest.csv"), [header, ...rows].join("\n") + "\n");
}

async function writeQrImages(outDir: string, plateSpecs: PlateSpec[]) {
  const qrDir = path.join(outDir, "qr_codes");
  await mkdir(qrDir, { recursive: true });
  for (const plate of plateSpecs) {
    if (!plate.qrUrl) continue;
    const buffer = await QRCode.toBuffer(plate.qrUrl, {
      errorCorrectionLevel: "H",
      width: 1000,
      margin: 2,
    });
    await writeFile(path.join(qrDir, `${plate.serialId}.png`), buffer);
  }
}

async function writeSpecSheet(outDir: string, batchName: string, plateSpecs: PlateSpec[]) {
  const counts = plateSpecs.reduce(
    (acc, p) => ({ ...acc, [p.capability]: acc[p.capability] + 1 }),
    { qr: 0, nfc: 0, combo: 0 } as Record<Capability, number>
  );

  const content = `# Manufacturing Spec Sheet — ${batchName}

## Order summary
- Total units: ${plateSpecs.length}
- QR-only: ${counts.qr}
- NFC-only: ${counts.nfc}
- Combo (QR + NFC): ${counts.combo}

## Locked in
- Bridge URL format: ${BASE_URL}/r/<serial_id>?src=qr (printed QR) or
  ${BASE_URL}/r/<serial_id>?src=nfc (NFC payload). The two channels for
  the same physical unit share a serial ID but carry different query
  markers — this is required for accurate QR-vs-NFC analytics, do not
  print/write a URL without the correct ?src= suffix.
- QR error correction level: H (high) — required so the code still scans
  reliably after months of wear/smudging on a table-top item.
- NFC chip: NDEF URI record, written with the exact nfc_payload value
  from manifest.csv per serial ID.
- Apply a read-only/password lock to each NFC chip after writing, to
  prevent field overwrite.

## Still to negotiate directly with the supplier (not decided yet)
- Physical dimensions and material (see attached reference photo for one
  possible direction — not yet confirmed as final).
- NFC chip model (NTAG213 vs NTAG215).
- Printed color/branding treatment.
- Lead time and per-unit pricing at this quantity.

## Delivered files
- \`manifest.csv\` — Serial_ID, Capability, Printed_Text, QR_Filename,
  QR_URL, NFC_Payload per unit.
- \`qr_codes/<serial_id>.png\` — QR image for every QR-capable unit
  (QR-only and combo). NFC-only units have no QR image.
`;

  await writeFile(path.join(outDir, "SPEC_SHEET.md"), content);
}

// Inserts the batch + its unassigned plates before any local file is
// written, so a local manifest/QR set is never generated for inventory
// that doesn't actually exist in the database — a scan against one of
// these serials resolves as "unassigned" (see V6b) from the moment this
// script finishes, not a 404, even before the physical units arrive.
async function createUnassignedInventory(batchName: string, plateSpecs: PlateSpec[]) {
  const [existing] = await db.select({ id: batches.id }).from(batches).where(eq(batches.name, batchName));
  if (existing) {
    throw new Error(
      `A batch named "${batchName}" already exists. Choose a different name, or this run may be a re-attempt after a partial failure — check the batches/plates tables before retrying.`
    );
  }

  const [batch] = await db.insert(batches).values({ name: batchName }).returning();

  try {
    await db.insert(plates).values(
      plateSpecs.map((p) => ({
        slug: p.serialId,
        capability: p.capability,
        status: "unassigned" as const,
        batchId: batch.id,
      }))
    );
  } catch (err) {
    // No transaction support across this insert pair (see PROJECT_FACTS.md
    // — the neon-http driver doesn't support db.transaction()), so a
    // failure here can leave an orphan batch row with zero plates. Low
    // volume, admin-only script — same accepted-risk class as
    // createBusinessOwner()'s two-write sequence.
    console.error(
      `Batch "${batchName}" (id ${batch.id}) was created but inserting its plates failed — ` +
        `the batch row is now orphaned with no plates. Delete it manually before retrying.`
    );
    throw err;
  }

  return batch;
}

async function main() {
  const batchName = process.argv[2];
  const count = Number(process.argv[3] ?? DEFAULT_COUNT);
  const mixArg = process.argv[4] ?? "even";
  const mix = CAPABILITY_MIXES[mixArg];

  if (!batchName || !Number.isInteger(count) || count <= 0 || !mix) {
    console.error("Usage: npm run batch:generate -- <batch-name> [count=30] [mix=even|qr|nfc|combo]");
    process.exit(1);
  }

  const plateSpecs = buildPlateSpecs(count, mix);

  await createUnassignedInventory(batchName, plateSpecs);

  const outDir = path.join(import.meta.dirname, "..", "qr-codes", batchName);
  await mkdir(outDir, { recursive: true });

  await writeManifest(outDir, plateSpecs);
  await writeQrImages(outDir, plateSpecs);
  await writeSpecSheet(outDir, batchName, plateSpecs);

  console.log(`Created batch "${batchName}" with ${plateSpecs.length} unassigned plates.`);
  console.log(`  QR-only: ${plateSpecs.filter((p) => p.capability === "qr").length}`);
  console.log(`  NFC-only: ${plateSpecs.filter((p) => p.capability === "nfc").length}`);
  console.log(`  Combo: ${plateSpecs.filter((p) => p.capability === "combo").length}`);
  console.log(`Files: ${outDir}`);
  console.log(`\nThese plates are real "unassigned" rows now — a scan against any of`);
  console.log(`these serials will show the "not yet activated" message, not a 404.`);
  console.log(`Assign them to a business once they're sold (admin UI: V6d, not yet built).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
