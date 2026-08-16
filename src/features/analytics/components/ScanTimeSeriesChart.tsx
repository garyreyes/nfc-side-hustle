"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScanTimeSeriesPoint } from "../api";

export function ScanTimeSeriesChart({ data }: { data: ScanTimeSeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        accessibilityLayer
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e3e6ea" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #e3e6ea",
            boxShadow: "0 8px 24px rgba(20, 23, 31, 0.08)",
            fontSize: 13,
          }}
          labelStyle={{ fontWeight: 650, color: "#14171f" }}
        />
        <Line type="monotone" dataKey="count" name="Scans" stroke="#157a53" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
