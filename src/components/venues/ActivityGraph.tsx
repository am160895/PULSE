"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import type { HistoryPoint } from "@/hooks/api";

export function ActivityGraph({ past, forecast }: { past: HistoryPoint[]; forecast: HistoryPoint[] }) {
  // "Typical" is plotted across the whole range (past and forecast both) so it's visibly
  // the same line "actual" runs on top of, until a real report pulls actual away from it —
  // for a venue nobody's reported at yet, that's the honest picture: there's no signal
  // besides the historical assumption, so the two lines should look identical right now.
  const data = [...past.map((p) => ({ time: p.time, actual: p.actual, typical: p.typical })), ...forecast.map((p) => ({ time: p.time, typical: p.typical }))];

  if (data.length < 2) {
    return <p className="text-[13px] text-[var(--text-muted)] py-6">Not enough data yet for an activity graph.</p>;
  }

  return (
    <div className="h-44 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => format(parseISO(t), "h:mm a")}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={45}
            interval="preserveStartEnd"
          />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(t) => format(parseISO(t as string), "h:mm a")}
          />
          {/* Purely decorative fill under the actual line — tooltipType="none" keeps it out
              of the hover tooltip, which otherwise listed "Actual" twice (once for this
              Area, once for the Line below sharing the same dataKey) alongside "Typical". */}
          <Area type="monotone" dataKey="actual" stroke="none" fill="url(#actualFill)" isAnimationActive={false} tooltipType="none" />
          <Line
            type="monotone"
            dataKey="typical"
            stroke="var(--text-muted)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] px-3 -mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: "var(--accent)" }} /> Actual
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed" style={{ borderColor: "var(--text-muted)" }} /> Typical
        </span>
      </div>
    </div>
  );
}
