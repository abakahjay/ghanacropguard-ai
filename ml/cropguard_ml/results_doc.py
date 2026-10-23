"""Write docs/RESULTS.md from the files the pipeline actually produced.

Every number in the generated document is read from:
  data/raw/manifest.json, data/prepared/dataset_report.json, ../logs/benchmark.log,
  runs/<run>/train_summary.json, runs/<run>/test_metrics.json, ../artifacts/models/selection.json.
Nothing is typed in by hand; missing inputs are reported as "not available yet".

    python -m cropguard_ml.results_doc --out ../docs/RESULTS.md
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from . import labels

RUNS = ["mobilenetv3_large", "efficientnet_b0", "convnext_tiny"]
PAPER_TOTAL = 24881  # image count stated in Mensah et al. (2023), Data in Brief 49:109306


def _load(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _pct(x) -> str:
    return "–" if x is None else f"{100 * x:.2f}%"


def _num(x, nd=4) -> str:
    return "–" if x is None else f"{x:.{nd}f}"


def _table(cols, rows) -> list[str]:
    out = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return out


def build(ml: Path, repo: Path) -> str:
    md: list[str] = ["# Results", ""]
    md += [f"_Generated {time.strftime('%Y-%m-%d %H:%M')} by `python -m cropguard_ml.results_doc` from the "
           "pipeline's own output files. Re-run it after training to refresh. No figure here is typed by hand._", ""]

    # ---- dataset -------------------------------------------------------------------------------
    manifest = _load(ml / "data/raw/manifest.json")
    rep = _load(ml / "data/prepared/dataset_report.json")
    md += ["## 1. Dataset", ""]
    if manifest is not None:
        files = manifest.get("files", manifest) if isinstance(manifest, dict) else manifest
        n_raw = len(files)
        md += [f"- Raw images downloaded from the CCMT \"Raw Data\" folders (Mendeley Data, DOI 10.17632/bwh3zbpkpv.1): "
               f"**{n_raw:,}**, each checked against the published size/CRC."]
        if n_raw != PAPER_TOTAL:
            md += [f"- The data article states {PAPER_TOTAL:,} raw images; the public archive actually contains {n_raw:,} "
                   f"({n_raw - PAPER_TOTAL:+,}). We used every file in the archive and report the difference instead of "
                   "silently matching the paper's figure."]
    if rep:
        st = rep.get("split_totals", {})
        md += [
            f"- Corrupt or undecodable files removed: {rep['corrupt_or_undecodable']}",
            f"- Exact-duplicate sets (identical SHA-256): {rep['exact_duplicate_sets']}; "
            f"same-class copies dropped: {rep['exact_duplicates_dropped_same_class']}; "
            f"images whose identical copy carries a *different* label (excluded entirely): {rep['label_conflict_images_dropped']}",
            f"- Near-duplicate pairs (dHash ≤ {rep['near_dup_threshold_bits']} bits): {rep['near_dup_pairs_within_class']} within a class "
            f"(kept together in one split), {rep['near_dup_pairs_cross_class']} across classes (reported)",
            f"- Images used: **{rep['images_kept']:,}** in {rep['groups']:,} leakage groups, {rep['num_classes']} classes",
            f"- Group-aware stratified split {'/'.join(str(int(r * 100)) for r in rep['ratios'])} (seed {rep['seed']}): "
            f"train {st.get('train', 0):,} · validation {st.get('val', 0):,} · test {st.get('test', 0):,}",
            "", "Per-class image counts after cleaning:", "",
        ]
        rows = []
        for name, c in sorted(rep["per_class"].items(), key=lambda kv: (labels.CLASSES[kv[0]].crop, kv[0])):
            ci = labels.CLASSES[name]
            rows.append([ci.crop.title(), ci.display_name, c.get("train", 0), c.get("val", 0), c.get("test", 0),
                         sum(c.get(k, 0) for k in ("train", "val", "test"))])
        md += _table(["Crop", "Class", "Train", "Val", "Test", "Total"], rows)
        md += ["", "![Class distribution](../ml/data/prepared/class_distribution.png)", ""]
    else:
        md += ["Dataset report not available yet.", ""]

    # ---- benchmark ------------------------------------------------------------------------------
    bench = []
    blog = repo / "logs/benchmark.log"
    if blog.exists():
        for line in blog.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            if line.startswith("{"):
                try:
                    bench.append(json.loads(line))
                except ValueError:
                    pass
    md += ["## 2. Hardware and training cost", ""]
    if bench:
        md += ["Measured on the development laptop (CPU only, no GPU) before training:", ""]
        md += _table(["Architecture", "Params (M)", "Train img/s", "Inference img/s", "Est. min/epoch"],
                     [[b["arch"], b["params_m"], b["train_img_s"], b["infer_img_s"], b["est_min_per_epoch"]] for b in bench])
        md += ["", "Epoch counts and time budgets in `ml/configs/*.yaml` were set from these measurements.", ""]

    # ---- models ---------------------------------------------------------------------------------
    md += ["## 3. Model comparison (held-out test split)", ""]
    rows, evaluated = [], {}
    for run in RUNS:
        ts = _load(ml / "runs" / run / "train_summary.json")
        tm = _load(ml / "runs" / run / "test_metrics.json")
        if not tm:
            rows.append([run, "not trained/evaluated yet"] + ["–"] * 8)
            continue
        evaluated[run] = tm
        rows.append([
            run, tm["arch"], f"{tm['params'] / 1e6:.2f}",
            _num((tm.get("best_val") or {}).get("macro_f1")),
            _pct(tm["accuracy"]), _pct(tm["top3_accuracy"]), _num(tm["f1_macro"]), _num(tm["ece_15bin"]),
            tm["latency_cpu"]["p50_ms"], f"{ts['epochs_run']} / {ts['train_minutes']}" if ts else "–",
        ])
    md += _table(["Run", "Architecture", "Params (M)", "Val macro-F1", "Test accuracy", "Test top-3",
                  "Test macro-F1", "ECE (15 bins)", "CPU ms/img (p50)", "Epochs / minutes"], rows)
    md += ["", "The test split was used once per model, after training and model selection rules were fixed.", ""]

    sel = _load(repo / "artifacts/models/selection.json")
    md += ["## 4. Deployed model", ""]
    if sel:
        s = sel["selected"]
        md += [f"- Selected bundle: **{s['bundle']}** (`{s['arch']}`)",
               f"- Rule: {sel['rule']}",
               f"- Validation macro-F1 {_num(s['val_macro_f1'])}, CPU p50 {s['cpu_p50_ms']} ms per image", ""]
        chosen_run = next((r for r, tm in evaluated.items() if tm["arch"] == s["arch"]), None)
    else:
        md += ["No model has been exported and selected yet.", ""]
        chosen_run = None

    # ---- detail for the deployed model ------------------------------------------------------------
    if chosen_run:
        tm = evaluated[chosen_run]
        md += [f"## 5. Per-class test results — {chosen_run}", "",
               f"Test images: {tm['n_images']:,} · accuracy {_pct(tm['accuracy'])} · macro precision "
               f"{_num(tm['precision_macro'])} · macro recall {_num(tm['recall_macro'])} · weighted F1 {_num(tm['f1_weighted'])} · "
               f"crop identified correctly {_pct(tm.get('crop_level_accuracy'))}", ""]
        prow = []
        for name, m in sorted(tm["per_class"].items(), key=lambda kv: kv[1]["f1"]):
            ci = labels.CLASSES[name]
            prow.append([ci.crop.title(), ci.display_name, _num(m["precision"], 3), _num(m["recall"], 3),
                         _num(m["f1"], 3), m["support"]])
        md += ["Sorted from weakest to strongest F1:", ""]
        md += _table(["Crop", "Class", "Precision", "Recall", "F1", "Test images"], prow)
        if tm.get("top_confusions"):
            md += ["", "Most frequent confusions:", ""]
            md += _table(["True class", "Predicted as", "Images"],
                         [[labels.CLASSES[c["true"]].display_name, labels.CLASSES[c["pred"]].display_name, c["count"]]
                          for c in tm["top_confusions"]])
        md += ["", f"Mean confidence when correct {_num(tm.get('mean_confidence_correct'), 3)}, "
               f"when wrong {_num(tm.get('mean_confidence_wrong'), 3)}.", "",
               f"![Normalised confusion matrix](../ml/runs/{chosen_run}/test_confusion_matrix_normalized.png)", "",
               f"![Learning curves](../ml/runs/{chosen_run}/learning_curves.png)", "",
               f"Misclassified test images are listed in `ml/runs/{chosen_run}/test_misclassified.csv`.", ""]

    md += ["## Limits of these numbers", "",
           "- All images come from one dataset collected in Ghana; test images share its cameras, seasons and framing. "
           "Accuracy on new farms, phones and lighting will be lower and has not been measured.",
           "- The near-duplicate grouping reduces, but cannot fully rule out, leakage between visually similar photos.",
           "- No field trial with farmers or extension officers has been carried out.",
           "- The app reports a preliminary, AI-assisted assessment, not a diagnosis.", ""]
    return "\n".join(md)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="../docs/RESULTS.md")
    args = ap.parse_args()
    ml = Path.cwd()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(ml, ml.parent), encoding="utf-8")
    print(f"wrote {out.resolve()}")


if __name__ == "__main__":
    main()
