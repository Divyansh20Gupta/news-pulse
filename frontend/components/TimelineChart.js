"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Converts cluster start/end timestamps into a "duration bar" the
// chart library can render — each row is one cluster.
function buildChartData(timeline) {
  if (!timeline.length) return { data: [], minTime: 0, maxTime: 1 };

  const times = timeline.flatMap((t) => [
    new Date(t.start).getTime(),
    new Date(t.end).getTime(),
  ]);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const data = timeline.map((t) => {
    const start = new Date(t.start).getTime();
    const end = new Date(t.end).getTime();
    return {
      id: t.id,
      label: t.label,
      article_count: t.article_count,
      intensity: t.intensity,
      sources: t.sources,
      // "offset" is invisible padding, "span" is the visible bar
      offset: start - minTime,
      span: Math.max(end - start, (maxTime - minTime) * 0.01), // min visible width
    };
  });

  return { data, minTime, maxTime };
}

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TimelineChart({ timeline, onSelectCluster, selectedId }) {
  const { data, minTime, maxTime } = buildChartData(timeline);

  if (!data.length) {
    return (
      <div className="border border-[var(--border)] rounded-lg p-12 bg-[var(--surface)] flex flex-col items-center justify-center gap-2 text-center">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-mid)]">
          No signal
        </span>
        <p className="text-sm text-[var(--text-dim)] max-w-xs">
          No clusters yet. Trigger a refresh to pull in news.
        </p>
      </div>
    );
  }

  const rowHeight = 36;
  const chartHeight = Math.max(data.length * rowHeight, 200);

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-mid)]">
          Timeline
        </span>
        <span className="font-mono text-[10px] text-[var(--text-mid)]">
          {data.length} {data.length === 1 ? "story" : "stories"}
        </span>
      </div>
      <div className="p-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          barCategoryGap={8}
        >
          <XAxis
            type="number"
            domain={[0, maxTime - minTime]}
            tickFormatter={(val) => formatTime(minTime + val)}
            stroke="var(--text-dim)"
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            stroke="var(--text-dim)"
            tick={{ fontSize: 12, fill: "var(--text)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono">
                  <div className="font-semibold mb-1 text-[var(--accent-text)]">{d.label}</div>
                  <div className="text-[var(--text-dim)]">{d.article_count} articles</div>
                  <div className="text-[var(--text-dim)]">{d.sources?.join(", ")}</div>
                </div>
              );
            }}
            cursor={{ fill: "var(--surface-hover)" }}
          />
          {/* Invisible offset bar pushes the visible bar to the right start time */}
          <Bar dataKey="offset" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="span"
            stackId="a"
            radius={[4, 4, 4, 4]}
            onClick={(d) => onSelectCluster(d.id)}
            cursor="pointer"
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell
                key={entry.id}
                fill={entry.id === selectedId ? "var(--accent)" : "var(--accent-dim)"}
                stroke="var(--accent)"
                strokeWidth={entry.id === selectedId ? 1.5 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
