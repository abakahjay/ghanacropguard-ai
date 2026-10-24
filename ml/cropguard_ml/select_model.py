"""Choose the model to serve, using VALIDATION results only, and activate its bundle.

Rule (fixed before any test result was seen): highest validation macro-F1; if two models are
within 0.5 percentage points, prefer the one with lower CPU latency. Test metrics are reported
for every model but never used for this choice.

    python -m cropguard_ml.select_model --runs runs --models ../artifacts/models
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", default="runs")
    ap.add_argument("--models", default="../artifacts/models")
    ap.add_argument("--tolerance", type=float, default=0.005)
    args = ap.parse_args()
    models = Path(args.models)

    cands = []
    for meta_p in sorted(models.glob("*/meta.json")):
        if meta_p.parent.name in ("active", "mobile"):
            continue
        meta = json.loads(meta_p.read_text())
        vb = meta.get("validation_best") or {}
        lat = ((meta.get("test_metrics") or {}).get("latency_cpu") or {}).get("p50_ms")
        cands.append({"bundle": meta_p.parent.name, "arch": meta["arch"], "val_macro_f1": vb.get("macro_f1"),
                      "val_acc": vb.get("acc"), "cpu_p50_ms": lat,
                      "test_macro_f1_reported_only": (meta.get("test_metrics") or {}).get("f1_macro"),
                      "leaf_check": meta.get("leaf_gate") is not None, "created_at": meta.get("created_at", "")})
    cands = [c for c in cands if c["val_macro_f1"] is not None]
    if not cands:
        raise SystemExit("No exported bundles with validation results found.")
    best_f1 = max(c["val_macro_f1"] for c in cands)
    near = [c for c in cands if best_f1 - c["val_macro_f1"] <= args.tolerance]
    # Ties (e.g. the same weights re-exported) go to the bundle with the leaf check, then the newest.
    near.sort(key=lambda c: c["created_at"], reverse=True)
    chosen = min(near, key=lambda c: (c["cpu_p50_ms"] if c["cpu_p50_ms"] is not None else 1e9, -c["val_macro_f1"],
                                      not c["leaf_check"]))

    active = models / "active"
    if active.exists():
        shutil.rmtree(active)
    shutil.copytree(models / chosen["bundle"], active)
    sel = {"selected": chosen, "candidates": cands, "rule": __doc__.split("\n\n")[1].strip(),
           "selected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    (models / "selection.json").write_text(json.dumps(sel, indent=2))

    # The lightweight model is also kept as the on-device candidate for the mobile app.
    mob = sorted(models.glob("mobilenetv3_large_100-*/model.int8.onnx"))
    if mob:
        dst = models / "mobile"
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(mob[-1].parent, dst)
    print(json.dumps(sel, indent=2))


if __name__ == "__main__":
    main()
