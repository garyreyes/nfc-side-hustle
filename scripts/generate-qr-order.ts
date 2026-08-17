import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateUniqueSlugs } from "../src/lib/slug";

// For stock whose QR code gets printed/etched by the supplier BEFORE it
// ever reaches us — the slug has to be decided now, not at arrival time
// like the normal (e.g. NFC) inventory-arrival flow. Run this BEFORE
// placing the order:
//
//   npm run qr:generate-order -- 50
//
// It writes two files into qr-codes/orders/<timestamp>/:
//   - supplier-urls.txt — the full URLs to hand the supplier for printing
//   - slugs.txt          — just the slugs, one per line, paste this into
//                          "Record inventory arrival"'s slug field once
//                          the batch physically arrives back
//
// Nothing here touches the database — these slugs don't exist as real
// plates until you actually record the arrival later.
const BASE_URL = process.env.QR_BASE_URL ?? "https://nfc-side-hustle.vercel.app";
const OUT_ROOT = path.join(import.meta.dirname, "..", "qr-codes", "orders");

async function main() {
  const countRaw = process.argv[2];
  const count = Number(countRaw);
  if (!countRaw || !Number.isInteger(count) || count <= 0) {
    console.error("Usage: npm run qr:generate-order -- <count>");
    process.exit(1);
  }

  const slugs = generateUniqueSlugs(count);
  const urls = slugs.map((slug) => `${BASE_URL}/r/${slug}?src=qr`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(OUT_ROOT, timestamp);
  await mkdir(outDir, { recursive: true });

  await writeFile(path.join(outDir, "supplier-urls.txt"), urls.join("\n") + "\n");
  await writeFile(path.join(outDir, "slugs.txt"), slugs.join("\n") + "\n");

  console.log(`Generated ${count} slugs.`);
  console.log(`\nSend this file's contents to the supplier for printing:`);
  console.log(path.join(outDir, "supplier-urls.txt"));
  console.log(`\nKeep this file — paste its contents into "Record inventory arrival"'s`);
  console.log(`slug field once the batch physically arrives back:`);
  console.log(path.join(outDir, "slugs.txt"));
}

main();
