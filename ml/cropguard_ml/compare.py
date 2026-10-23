"""Build the architecture comparison table from evaluated runs.

    python -m cropguard_ml.compare runs/mobilenetv3 runs/efficientnet_b0 runs/convnext_tiny
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    rows = []
    for run in map(Path, sys.argv[1:]):
        t = run / "test_metrics.json"
        s = run / "train_summary.json"
        if not t.exists():
            print(f"skip {run}: no test_metrics.json")
            continue
        tm, ts = json.loads(t.read_text()), json.loads(s.read_text()) if s.exists() else {}
        rows.append({
            "run": run.name, "arch": tm["arch"], "params_m": round(tm["params"] / 1e6, 2),
            "val_macro_f1": round(tm["best_val"]["macro_f1"], 4),
            "test_acc": round(tm["accuracy"], 4), "test_top3": round(tm["top3_accuracy"], 4),
            "test_macro_f1": round(tm["f1_macro"], 4), "test_weighted_f1": round(tm["f1_weighted"], 4),
            "ece": round(tm["ece_15bin"], 4), "cpu_ms_p50": tm["latency_cpu"]["p50_ms"],
            "train_minutes": ts.get("train_minutes"), "epochs": ts.get("epochs_run"),
        })
    if not rows:
        return
    cols = list(rows[0])
    md = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    md += ["| " + " | ".join(str(r[c]) for c in cols) + " |" for r in rows]
    out = Path("reports")
    out.mkdir(exist_ok=True)
    (out / "model_comparison.md").write_text("\n".join(md) + "\n")
    (out / "model_comparison.json").write_text(json.dumps(rows, indent=2))
    print("\n".join(md))


if __name__ == "__main__":
    main()
