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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="count" name="Scans" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
