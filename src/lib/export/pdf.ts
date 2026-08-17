import "server-only";
import PDFDocument from "pdfkit";

type InventorySummaryRow = {
  capability: string;
  ordered: number;
  remaining: number;
  soldAllTime: number;
  totalCostCents: number | null;
  revenueAllTimeCents: number | null;
  profitAllTimeCents: number | null;
};

function formatPeso(cents: number | null): string {
  if (cents == null) return "—";
  return `P${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Collects pdfkit's stream output into a single Buffer — pdfkit is
// stream-based (built for piping to a response/file), but a Route
// Handler needs the whole file in memory to return as one Response body.
function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

// Hand-laid-out columns rather than a table library — pdfkit has no
// built-in table support, and this report only ever has up to 3 rows
// (one per capability), so a fixed-column approach is simpler and more
// reliable than pulling in another dependency for it.
const COLS = [
  { label: "Capability", x: 50, width: 90 },
  { label: "Ordered", x: 140, width: 60 },
  { label: "Remaining", x: 200, width: 65 },
  { label: "Sold", x: 265, width: 55 },
  { label: "Total Cost", x: 320, width: 90 },
  { label: "Revenue", x: 410, width: 90 },
  { label: "Profit", x: 500, width: 90 },
];

export async function buildInventoryReport(input: { summary: InventorySummaryRow[] }): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });

  doc.fontSize(20).font("Helvetica-Bold").text("Inventory Summary Report");
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#555555")
    .text(`Generated ${new Date().toLocaleString("en-PH")}`);
  doc.moveDown(1.5);

  const totals = input.summary.reduce(
    (acc, row) => ({
      ordered: acc.ordered + row.ordered,
      remaining: acc.remaining + row.remaining,
      sold: acc.sold + row.soldAllTime,
      totalCostCents: acc.totalCostCents + (row.totalCostCents ?? 0),
      revenueCents: acc.revenueCents + (row.revenueAllTimeCents ?? 0),
      profitCents: acc.profitCents + (row.profitAllTimeCents ?? 0),
    }),
    { ordered: 0, remaining: 0, sold: 0, totalCostCents: 0, revenueCents: 0, profitCents: 0 }
  );

  doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text("Totals");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      `Ordered: ${totals.ordered}   Remaining: ${totals.remaining}   Sold: ${totals.sold}   ` +
        `Total Cost: ${formatPeso(totals.totalCostCents)}   Revenue: ${formatPeso(totals.revenueCents)}   ` +
        `Profit: ${formatPeso(totals.profitCents)}`
    );
  doc.moveDown(1.5);

  doc.fontSize(12).font("Helvetica-Bold").text("By Capability");
  doc.moveDown(0.5);
  const tableTop = doc.y;
  doc.fontSize(9).font("Helvetica-Bold");
  for (const col of COLS) {
    doc.text(col.label, col.x, tableTop, { width: col.width });
  }
  doc.moveDown(0.5);
  doc
    .moveTo(50, doc.y)
    .lineTo(590, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica");
  for (const row of input.summary) {
    const y = doc.y;
    const values = [
      row.capability.toUpperCase(),
      String(row.ordered),
      String(row.remaining),
      String(row.soldAllTime),
      formatPeso(row.totalCostCents),
      formatPeso(row.revenueAllTimeCents),
      formatPeso(row.profitAllTimeCents),
    ];
    COLS.forEach((col, i) => doc.text(values[i], col.x, y, { width: col.width }));
    doc.moveDown(0.6);
  }

  doc.moveDown(1);
  doc.fontSize(12).font("Helvetica-Bold").text("Most Sold (by capability)");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");
  const ranked = [...input.summary].sort((a, b) => b.soldAllTime - a.soldAllTime);
  ranked.forEach((row, i) => {
    doc.text(`${i + 1}. ${row.capability.toUpperCase()} — ${row.soldAllTime} sold`);
  });

  return collect(doc);
}
