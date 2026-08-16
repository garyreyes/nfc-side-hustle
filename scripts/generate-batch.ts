import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

// Excludes ambiguous characters (0/o, 1/l/i) so a human reading the printed
// serial ID off a physical unit can't misread or mistype it.
const SLUG_CHARSET = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LENGTH = 6;

const BASE_URL = process.env.QR_BASE_URL ?? "https://nfc-side-hustle.vercel.app";

type Capability = "qr" | "nfc" | "combo";

interface PlateSpec {
  serialId: string;
  capability: Capability;
  qrUrl: string | null;
  nfcPayload: string | null;
}

function randomSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += SLUG_CHARSET[Math.floor(Math.random() * SLUG_CHARSET.length)];
  }
  return slug;
}

function uniqueSlugs(count: number): string[] {
  const slugs = new Set<string>();
  while (slugs.size < count) {
    slugs.add(randomSlug());
  }
  return [...slugs];
}

function buildPlateSpecs(count: number, mix: Capability[]): PlateSpec[] {
  const slugs = uniqueSlugs(count);
  return slugs.map((slug, i) => {
    const capability = mix[i % mix.length];
    const path = `/r/${slug}`;
    return {
      serialId: slug,
      capability,
      qrUrl: capability !== "nfc" ? `${BASE_URL}${path}?src=qr` : null,
      nfcPayload: capability !== "qr" ? `${BASE_URL}${path}?src=nfc` : null,
    };
  });
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function writeManifest(outDir: string, plates: PlateSpec[]) {
  const header = "Serial_ID,Capability,Printed_Text,QR_Filename,QR_URL,NFC_Payload";
  const rows = plates.map((p) =>
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

async function writeQrImages(outDir: string, plates: PlateSpec[]) {
  const qrDir = path.join(outDir, "qr_codes");
  await mkdir(qrDir, { recursive: true });
  for (const plate of plates) {
    if (!plate.qrUrl) continue;
    const buffer = await QRCode.toBuffer(plate.qrUrl, {
      errorCorrectionLevel: "H",
      width: 1000,
      margin: 2,
    });
    await writeFile(path.join(qrDir, `${plate.serialId}.png`), buffer);
  }
}

async function writeSpecSheet(outDir: string, batchName: string, plates: PlateSpec[]) {
  const counts = plates.reduce(
    (acc, p) => ({ ...acc, [p.capability]: acc[p.capability] + 1 }),
    { qr: 0, nfc: 0, combo: 0 } as Record<Capability, number>
  );

  const content = `# Manufacturing Spec Sheet — ${batchName}

## Order summary
- Total units: ${plates.length}
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

async function main() {
  const batchName = process.argv[2];
  if (!batchName) {
    console.error("Usage: npm run batch:generate -- <batch-name>");
    process.exit(1);
  }

  const mix: Capability[] = ["qr", "nfc", "combo"];
  const plates = buildPlateSpecs(30, mix);

  const outDir = path.join(import.meta.dirname, "..", "qr-codes", batchName);
  await mkdir(outDir, { recursive: true });

  await writeManifest(outDir, plates);
  await writeQrImages(outDir, plates);
  await writeSpecSheet(outDir, batchName, plates);

  console.log(`Generated ${plates.length} plate specs for batch "${batchName}"`);
  console.log(`  QR-only: ${plates.filter((p) => p.capability === "qr").length}`);
  console.log(`  NFC-only: ${plates.filter((p) => p.capability === "nfc").length}`);
  console.log(`  Combo: ${plates.filter((p) => p.capability === "combo").length}`);
  console.log(`Output: ${outDir}`);
  console.log(`\nIMPORTANT: these serial IDs have no database row yet.`);
  console.log(`They will 404 if scanned before V6a ships and they're inserted`);
  console.log(`as 'unassigned' plates. Do not hand out physical units until then.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
