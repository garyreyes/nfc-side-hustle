import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const BASE_URL = process.env.QR_BASE_URL ?? "https://nfc-side-hustle.vercel.app";
const OUT_DIR = path.join(import.meta.dirname, "..", "qr-codes");
const SLUG_PATTERN = /^[a-z0-9-]+$/;

async function verifySlugResolves(url: string) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 302) {
    throw new Error(
      `${url} did not return a 302 redirect (got ${response.status}). ` +
        `Refusing to generate a QR for a slug that doesn't resolve to a real card.`
    );
  }
}

async function generateQr(slug: string) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid slug "${slug}" — must match ${SLUG_PATTERN}`);
  }

  const url = `${BASE_URL}/r/${slug}`;
  await verifySlugResolves(url);

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${slug}.png`);
  const buffer = await QRCode.toBuffer(url, {
    width: 1024,
    margin: 2,
  });
  await writeFile(outPath, buffer);

  console.log(`Verified ${url} resolves correctly.`);
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
