"""Evaluate a trained checkpoint on the held-out TEST split (run once, after model selection).

    python -m cropguard_ml.evaluate --run runs/mobilenetv3 --prepared data/prepared

Writes into the run directory:
  test_metrics.json, per_class_report.csv, confusion_matrix.png,
  confusion_matrix_normalized.png, misclassified.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    precision_score,
    recall_score,
    top_k_accuracy_score,
)
from torch.utils.data import DataLoader

from . import labels
from .data import CCMTDataset
from .preprocess import PreprocessConfig, build_eval_transform
from .train import create_model


def load_checkpoint(run: Path):
    ck = torch.load(run / "best.pt", map_location="cpu", weights_only=False)
    model = create_model(ck["arch"], ck["num_classes"], pretrained=False)
    model.load_state_dict(ck["state_dict"])
    model.eval()
    return model, ck


def expected_calibration_error(probs: np.ndarray, y: np.ndarray, bins: int = 15) -> float:
    conf = probs.max(1)
    pred = probs.argmax(1)
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            ece += m.mean() * abs((pred[m] == y[m]).mean() - conf[m].mean())
    return float(ece)


@torch.no_grad()
def measure_latency(model, image_size: int, runs: int = 50, threads: int | None = None) -> dict:
    if threads:
        torch.set_num_threads(threads)
    x = torch.randn(1, 3, image_size, image_size)
    for _ in range(10):
        model(x)
    times = []
    for _ in range(runs):
        t = time.perf_counter()
        model(x)
        times.append((time.perf_counter() - t) * 1000)
    times.sort()
    return {"batch": 1, "runs": runs, "threads": torch.get_num_threads(),
            "mean_ms": round(statistics.mean(times), 2),
            "p50_ms": round(times[len(times) // 2], 2),
            "p95_ms": round(times[int(len(times) * 0.95) - 1], 2)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--prepared", default="data/prepared")
    ap.add_argument("--split", default="test", choices=["val", "test"])
    ap.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 2))
    args = ap.parse_args()
    run = Path(args.run)

    model, ck = load_checkpoint(run)
    pcfg = PreprocessConfig.from_dict(ck["preprocess"])
    ds = CCMTDataset(args.prepared, args.split, build_eval_transform(pcfg))
    if ds.class_to_idx != ck["class_to_idx"]:
        raise SystemExit("class_to_idx mismatch between checkpoint and prepared data")
    dl = DataLoader(ds, 64, shuffle=False, num_workers=args.workers)
    idx_to_key = {v: k for k, v in ck["class_to_idx"].items()}
    names = [idx_to_key[i] for i in range(len(idx_to_key))]

    probs_all, ys = [], []
    t0 = time.time()
    model = model.to(memory_format=torch.channels_last)
    with torch.inference_mode():
        for x, y in dl:
            probs_all.append(torch.softmax(model(x.to(memory_format=torch.channels_last)), 1).numpy())
            ys.append(y.numpy())
    probs = np.concatenate(probs_all)
    y = np.concatenate(ys)
    pred = probs.argmax(1)
    eval_seconds = time.time() - t0

    p, r, f, s = precision_recall_fscore_support(y, pred, labels=range(len(names)), zero_division=0)
    cm = confusion_matrix(y, pred, labels=range(len(names)))
    params = sum(p_.numel() for p_ in model.parameters())
    ckpt_mb = (run / "best.pt").stat().st_size / 1e6

    metrics = {
        "split": args.split,
        "run": run.name,
        "arch": ck["arch"],
        "n_images": int(len(y)),
        "accuracy": float(accuracy_score(y, pred)),
        "top3_accuracy": float(top_k_accuracy_score(y, probs, k=3, labels=range(len(names)))),
        "precision_macro": float(precision_score(y, pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y, pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y, pred, average="macro", zero_division=0)),
        "precision_weighted": float(precision_score(y, pred, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(y, pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y, pred, average="weighted", zero_division=0)),
        "ece_15bin": expected_calibration_error(probs, y),
        "mean_confidence_correct": float(probs.max(1)[pred == y].mean()) if (pred == y).any() else None,
        "mean_confidence_wrong": float(probs.max(1)[pred != y].mean()) if (pred != y).any() else None,
        "crop_level_accuracy": float(np.mean([labels.CLASSES[names[a]].crop == labels.CLASSES[names[b]].crop
                                              for a, b in zip(y, pred, strict=True)])),
        "params": int(params),
        "checkpoint_mb": round(ckpt_mb, 2),
        "latency_cpu": measure_latency(model, pcfg.image_size),
        "eval_seconds": round(eval_seconds, 1),
        "best_val": ck.get("best"),
        "per_class": {names[i]: {"precision": float(p[i]), "recall": float(r[i]),
                                 "f1": float(f[i]), "support": int(s[i])} for i in range(len(names))},
    }
    # most confused pairs (error analysis)
    off = cm.copy()
    np.fill_diagonal(off, 0)
    pairs = np.dstack(np.unravel_index(np.argsort(off.ravel())[::-1], off.shape))[0]
    metrics["top_confusions"] = [
        {"true": names[a], "pred": names[b], "count": int(off[a, b])}
        for a, b in pairs[:12] if off[a, b] > 0
    ]
    (run / f"{args.split}_metrics.json").write_text(json.dumps(metrics, indent=2))

    with open(run / f"{args.split}_per_class_report.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["class", "crop", "display_name", "precision", "recall", "f1", "support"])
        for i, n in enumerate(names):
            ci = labels.CLASSES[n]
            w.writerow([n, ci.crop, ci.display_name, f"{p[i]:.4f}", f"{r[i]:.4f}", f"{f[i]:.4f}", s[i]])

    with open(run / f"{args.split}_misclassified.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["rel", "true", "pred", "confidence"])
        for i in np.nonzero(pred != y)[0]:
            w.writerow([ds.rows[i]["rel"], names[y[i]], names[pred[i]], f"{probs[i].max():.4f}"])

    np.save(run / f"{args.split}_confusion_matrix.npy", cm)
    _plot_cm(cm, names, run / f"{args.split}_confusion_matrix.png", normalize=False)
    _plot_cm(cm, names, run / f"{args.split}_confusion_matrix_normalized.png", normalize=True)
    print(json.dumps({k: v for k, v in metrics.items() if k not in ("per_class",)}, indent=2))


def _plot_cm(cm, names, path, normalize):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    m = cm.astype(float)
    if normalize:
        m = m / np.maximum(m.sum(1, keepdims=True), 1)
    short = [f"{labels.CLASSES[n].crop[:4].title()}·{labels.CLASSES[n].display_name}" for n in names]
    fig, ax = plt.subplots(figsize=(13, 11))
    im = ax.imshow(m, cmap="Greens")
    ax.set_xticks(range(len(names)), short, rotation=70, ha="right", fontsize=8)
    ax.set_yticks(range(len(names)), short, fontsize=8)
    ax.set_xlabel("predicted")
    ax.set_ylabel("true")
    for i in range(len(names)):
        for j in range(len(names)):
            v = m[i, j]
            if v > (0.005 if normalize else 0):
                ax.text(j, i, f"{v:.2f}" if normalize else int(v), ha="center", va="center",
                        fontsize=6, color="white" if v > m.max() * 0.6 else "black")
    fig.colorbar(im, fraction=0.04)
    ax.set_title("Confusion matrix" + (" (row-normalised)" if normalize else ""))
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
