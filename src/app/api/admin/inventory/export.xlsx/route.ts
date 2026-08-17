import { NextResponse } from "next/server";
import { getInventorySummary, listBatchSummaries, listSoldPlates } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { buildInventoryWorkbook } from "@/lib/export/xlsx";

export async function GET() {
  await requirePlatformAdmin();

  const [summary, batches, soldPlates] = await Promise.all([
    getInventorySummary(),
    listBatchSummaries(),
    listSoldPlates(),
  ]);

  const buffer = await buildInventoryWorkbook({ summary, batches, soldPlates });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-${date}.xlsx"`,
    },
  });
}
