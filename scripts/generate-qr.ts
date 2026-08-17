import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { isValidSlug, SLUG_PATTERN } from "../src/lib/slug";

const BASE_URL = process.env.QR_BASE_URL ?? "https://nfc-side-hustle.vercel.app";
const OUT_DIR = path.join(import.meta.dirname, "..", "qr-codes");

async function verifySlugResolves(url: string) {
  // Verified against the plain (no ?src=) URL, not the ?src=qr one
  // actually encoded below — the redirect route's behavior (302 vs
  // unassigned/suspended message) doesn't depend on that param, so this
  // stays a clean check of "does this slug exist and resolve" without
  // needing to special-case the marker.
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 302) {
    throw new Error(
      `${url} did not return a 302 redirect (got ${response.status}). ` +
        `Refusing to generate a QR for a slug that doesn't resolve to a real plate.`
    );
  }
}

async function generateQr(slug: string) {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug "${slug}" — must match ${SLUG_PATTERN}`);
  }

  const plainUrl = `${BASE_URL}/r/${slug}`;
  await verifySlugResolves(plainUrl);

  // ?src=qr is what the redirect route (see src/app/r/[slug]/route.ts)
  // reads to attribute a scan to the QR channel vs NFC vs unknown —
  // without it, every QR scan would log as "unknown" and the "By
  // channel" breakdown on the analytics dashboards would never show any
  // QR activity at all.
  const url = `${plainUrl}?src=qr`;

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${slug}.png`);
  const buffer = await QRCode.toBuffer(url, {
    width: 1024,
    margin: 2,
  });
  await writeFile(outPath, buffer);

  console.log(`Verified ${plainUrl} resolves correctly.`);
  console.log(`Generated QR for ${url}`);
  console.log(`Saved to ${outPath}`);
}

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run qr:generate -- <slug>");
  process.exit(1);
}

generateQr(slug).catch((err) => {
  console.error(err);
  process.exit(1);
});
