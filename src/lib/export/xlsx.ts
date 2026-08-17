import "server-only";
import ExcelJS from "exceljs";

// Cents in, pesos (major units) out — every money column in the
// spreadsheet is a plain number, not a formatted string, so it stays
// sortable/summable in Excel. null stays blank rather than becoming 0,
// matching the "untracked, not zero" distinction used everywhere else
// cost/price data appears in this codebase.
function centsToPesos(cents: number | null): number | null {
  return cents == null ? null : Math.round(cents) / 100;
}

type InventorySummaryRow = {
  capability: string;
  ordered: number;
  remaining: number;
  soldToday: number;
  soldThisWeek: number;
  soldThisMonth: number;
  soldAllTime: number;
  totalCostCents: number | null;
  averageCostCents: number | null;
  revenueAllTimeCents: number | null;
  costOfGoodsSoldCents: number | null;
  profitAllTimeCents: number | null;
};

type BatchRow = {
  batchName: string;
  orderedAt: Date;
  capability: string;
  quantity: number;
  totalCostCents: number | null;
  sold: number;
  remaining: number;
};

type SoldPlateRow = {
  slug: string;
  capability: string;
  businessName: string | null;
  branchName: string | null;
  batchName: string | null;
  soldAt: Date;
  unitCostCents: number | null;
  sellPriceCents: number | null;
  profitCents: number | null;
};

export async function buildInventoryWorkbook(input: {
  summary: InventorySummaryRow[];
  batches: BatchRow[];
  soldPlates: SoldPlateRow[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "nfc-side-hustle";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Inventory Summary");
  summarySheet.columns = [
    { header: "Capability", key: "capability", width: 12 },
    { header: "Ordered", key: "ordered", width: 10 },
    { header: "Remaining", key: "remaining", width: 11 },
    { header: "Sold Today", key: "soldToday", width: 11 },
    { header: "Sold This Week", key: "soldThisWeek", width: 14 },
    { header: "Sold This Month", key: "soldThisMonth", width: 15 },
    { header: "Sold All Time", key: "soldAllTime", width: 13 },
    { header: "Total Cost (₱)", key: "totalCostPesos", width: 14 },
    { header: "Avg. Cost (₱)", key: "averageCostPesos", width: 13 },
    { header: "Revenue All Time (₱)", key: "revenuePesos", width: 18 },
    { header: "Cost of Goods Sold (₱)", key: "cogsPesos", width: 20 },
    { header: "Profit All Time (₱)", key: "profitPesos", width: 17 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  for (const row of input.summary) {
    summarySheet.addRow({
      capability: row.capability.toUpperCase(),
      ordered: row.ordered,
      remaining: row.remaining,
      soldToday: row.soldToday,
      soldThisWeek: row.soldThisWeek,
      soldThisMonth: row.soldThisMonth,
      soldAllTime: row.soldAllTime,
      totalCostPesos: centsToPesos(row.totalCostCents),
      averageCostPesos: centsToPesos(row.averageCostCents),
      revenuePesos: centsToPesos(row.revenueAllTimeCents),
      cogsPesos: centsToPesos(row.costOfGoodsSoldCents),
      profitPesos: centsToPesos(row.profitAllTimeCents),
    });
  }

  const batchesSheet = workbook.addWorksheet("Batches");
  batchesSheet.columns = [
    { header: "Batch", key: "batchName", width: 20 },
    { header: "Ordered On", key: "orderedAt", width: 14 },
    { header: "Capability", key: "capability", width: 12 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Total Cost (₱)", key: "totalCostPesos", width: 14 },
    { header: "Sold", key: "sold", width: 8 },
    { header: "Remaining", key: "remaining", width: 11 },
  ];
  batchesSheet.getRow(1).font = { bold: true };
  for (const row of input.batches) {
    batchesSheet.addRow({
      batchName: row.batchName,
      orderedAt: row.orderedAt,
      capability: row.capability.toUpperCase(),
      quantity: row.quantity,
      totalCostPesos: centsToPesos(row.totalCostCents),
      sold: row.sold,
      remaining: row.remaining,
    });
  }
  batchesSheet.getColumn("orderedAt").numFmt = "yyyy-mm-dd";

  const soldSheet = workbook.addWorksheet("Items Sold");
  soldSheet.columns = [
    { header: "Slug", key: "slug", width: 12 },
    { header: "Capability", key: "capability", width: 12 },
    { header: "Business", key: "businessName", width: 24 },
    { header: "Branch", key: "branchName", width: 20 },
    { header: "Batch", key: "batchName", width: 16 },
    { header: "Sold On", key: "soldAt", width: 14 },
    { header: "Unit Cost (₱)", key: "costPesos", width: 13 },
    { header: "Sale Price (₱)", key: "salePesos", width: 14 },
    { header: "Profit (₱)", key: "profitPesos", width: 12 },
  ];
  soldSheet.getRow(1).font = { bold: true };
  for (const row of input.soldPlates) {
    soldSheet.addRow({
      slug: row.slug,
      capability: row.capability.toUpperCase(),
      businessName: row.businessName ?? "",
      branchName: row.branchName ?? "",
      batchName: row.batchName ?? "",
      soldAt: row.soldAt,
      costPesos: centsToPesos(row.unitCostCents),
      salePesos: centsToPesos(row.sellPriceCents),
      profitPesos: centsToPesos(row.profitCents),
    });
  }
  soldSheet.getColumn("soldAt").numFmt = "yyyy-mm-dd hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
