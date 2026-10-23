const CROP_NAME = { cashew: "Cashew", cassava: "Cassava", maize: "Maize", tomato: "Tomato" };

/**
 * The product's signature element: ranked conditions with their model confidence.
 * Gold is the one data hue (top result only); alternatives are grey. Bars are the true ratio.
 */
export function ConfidenceBars({ items, compact = false }) {
  return (
    <ol data-ui className={`grid ${compact ? "gap-2.5" : "gap-3.5"}`} aria-label="Model confidence by condition">
      {items.map((it, i) => {
        const pct = Math.round(it.confidence * 1000) / 10;
        return (
          <li key={it.class_key} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-4 text-[15px]">
              <span className={i === 0 ? "text-ink font-medium" : "text-ink-2"}>
                {it.display_name} <span className="text-muted font-normal">· {CROP_NAME[it.crop] ?? it.crop}</span>
              </span>
              <span className={`tabular shrink-0 ${i === 0 ? "text-ink" : "text-muted"}`}>{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-raised" aria-hidden="true">
              <div
                className={`h-2 rounded-full ${i === 0 ? "bg-accent" : "bg-[#5d6b60]"}`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
