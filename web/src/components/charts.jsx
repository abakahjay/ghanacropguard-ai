/*
  Small SVG charts drawn to the app-screen rules: one hue on the main series (maize gold),
  3-5 faint horizontal gridlines, no y-axis line, round ticks with the top tick above the max,
  square-cornered columns, x labels flat and on one step.
*/

function niceMax(v) {
  if (v <= 4) return { max: 4, step: 1 };
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { max: Math.ceil(v / step) * step === v ? v + step : Math.ceil(v / step) * step, step };
}

export function DailyColumns({ data, height = 200 }) {
  const W = 720;
  const H = height;
  const padL = 36,
    padB = 26,
    padT = 8;
  const top = Math.max(1, ...data.map((d) => d.success + d.failed));
  const { max, step } = niceMax(top);
  const plotW = W - padL - 4;
  const plotH = H - padB - padT;
  const n = Math.max(data.length, 1);
  const bw = Math.max(2, Math.min(28, (plotW / n) * 0.7));
  const x = (i) => padL + (plotW / n) * (i + 0.5);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Requests per day: ${data.map((d) => `${d.date} ${d.success} successful, ${d.failed} failed`).join("; ")}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? "#3a4a3e" : "#1f2b22"}
            strokeWidth={t === 0 ? 1.5 : 1}
          />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)" className="tabular">
            {t}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={d.date}>
          <rect x={x(i) - bw / 2} y={y(d.success)} width={bw} height={y(0) - y(d.success)} fill="var(--accent)" />
          {d.failed > 0 && (
            <rect
              x={x(i) - bw / 2}
              y={y(d.success + d.failed)}
              width={bw}
              height={y(d.success) - y(d.success + d.failed) - 1.5}
              fill="var(--negative)"
            />
          )}
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">
              {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarList({ rows, highlightFirst = true }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="grid gap-3">
      {rows.map((r, i) => (
        <li key={r.label + i} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate">
              {r.label}
              {r.sub && <span className="text-muted"> · {r.sub}</span>}
            </span>
            <span className="tabular shrink-0 text-ink-2">
              {r.value.toLocaleString("en-GB")}
              <span className="ml-1.5 text-muted">{total ? `${((r.value / total) * 100).toFixed(0)}%` : "–"}</span>
            </span>
          </div>
          <div className="h-[3px] rounded-full" aria-hidden="true">
            <div
              className={`h-[3px] rounded-full ${i === 0 && highlightFirst ? "bg-accent" : "bg-[#5d6b60]"}`}
              style={{ width: `${(r.value / max) * 88}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
