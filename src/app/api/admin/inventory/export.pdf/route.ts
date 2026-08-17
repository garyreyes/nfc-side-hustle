import { NextResponse } from "next/server";
import { getInventorySummary } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { buildInventoryReport } from "@/lib/export/pdf";

export async function GET() {
  await requirePlatformAdmin();

  const summary = await getInventorySummary();
  const buffer = await buildInventoryReport({ summary });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inventory-report-${date}.pdf"`,
    },
  });
}
