"""Leaf check: is this photo a crop leaf at all?

    python -m cropguard_ml.leaf_gate --run runs/mobilenetv3_large

The classifier only knows the 22 CCMT classes, so it puts *every* photo into one of
them (a shoe becomes "grasshopper"). This fits a logistic-regression "leaf / not a
leaf" head on the trained model's penultimate features:

  positives  CCMT photos (train split to fit, val split to set the threshold, test split to report)
  negatives  Imagenette (10 ImageNet classes), Caltech-101 without its plant categories,
             and generated documents, screenshots, flat colours and noise; split 70/15/15
             by content hash

The threshold is chosen on validation only: the highest score that still accepts
LEAF_RECALL of the validation leaves. Test numbers are reported, never used.
Writes <run>/leaf_gate.json, which `export` folds into the ONNX graph as a second
output, "leaf_score".

Data (downloaded on first run into data/negatives/, not committed):
  imagenette/imagenette2-320.tgz  https://s3.amazonaws.com/fast-ai-imageclas/imagenette2-320.tgz
  caltech101/train.parquet        https://huggingface.co/datasets/flwrlabs/caltech101
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import random
import tarfile
import time
from pathlib import Path

import numpy as np
import torch

from .data import read_splits
from .evaluate import load_checkpoint
from .preprocess import PreprocessConfig, load_image, preprocess_eval

LEAF_RECALL = 0.99
# Caltech-101 categories that are plants or mostly foliage: never "not a leaf".
CALTECH_PLANTS = {"bonsai", "lotus", "sunflower", "water_lilly", "strawberry", "joshua_tree",
                  "BACKGROUND_Google"}  # the last one is random web photos, often of plants
SOURCES = {
    "imagenette": "https://s3.amazonaws.com/fast-ai-imageclas/imagenette2-320.tgz",
    "caltech101": "https://huggingface.co/datasets/flwrlabs/caltech101",
}
FILES = {
    "imagenette/imagenette2-320.tgz": SOURCES["imagenette"],
    "caltech101/train.parquet": SOURCES["caltech101"] + "/resolve/main/data/train-00000-of-00001.parquet",
}


def download(root: Path) -> None:
    import requests

    for rel, url in FILES.items():
        dest = root / rel
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        part = dest.with_suffix(dest.suffix + ".part")
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(part, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
        part.rename(dest)


def _split_of(data: bytes) -> str:
    h = int(hashlib.sha256(data).hexdigest()[:8], 16) % 100
    return "train" if h < 70 else "val" if h < 85 else "test"


def imagenette(root: Path):
    tgz = root / "imagenette" / "imagenette2-320.tgz"
    with tarfile.open(tgz) as tf:
        for m in tf:
            if m.isfile() and m.name.lower().endswith((".jpeg", ".jpg")):
                yield "imagenette", tf.extractfile(m).read()


def caltech(root: Path):
    import pyarrow.parquet as pq

    table = pq.read_table(root / "caltech101" / "train.parquet")
    names = table.schema.field("label").metadata
    label_names = json.loads(names[b"names"]) if names and b"names" in names else None
    if label_names is None:  # the HF card stores names in the dataset info instead
        info = json.loads(table.schema.metadata[b"huggingface"])
        label_names = info["info"]["features"]["label"]["names"]
    for row in table.to_pylist():
        if label_names[row["label"]] in CALTECH_PLANTS:
            continue
        yield "caltech101", row["image"]["bytes"]


def synthetic(n: int = 1500, seed: int = 7):
    """Things people send by mistake: documents, screenshots, flat colour, noise."""
    from PIL import Image, ImageDraw

    rng = random.Random(seed)
    words = ["invoice", "total", "cedis", "date", "name", "phone", "Accra", "Kumasi", "farm", "market",
             "price", "order", "receipt", "account", "balance", "meeting", "notes", "chapter", "report"]
    for i in range(n):
        kind = i % 4
        w, h = rng.choice([(720, 1280), (1080, 1920), (1280, 720), (800, 800)])
        if kind == 0:  # document / receipt
            im = Image.new("RGB", (w, h), tuple(rng.randint(225, 255) for _ in range(3)))
            d = ImageDraw.Draw(im)
            y = rng.randint(20, 80)
            while y < h - 30:
                line = " ".join(rng.choice(words) for _ in range(rng.randint(2, 9)))
                d.text((rng.randint(20, 60), y), line, fill=tuple(rng.randint(0, 80) for _ in range(3)))
                y += rng.randint(18, 40)
        elif kind == 1:  # app screenshot: bars, cards, text
            bg = tuple(rng.randint(0, 255) for _ in range(3))
            im = Image.new("RGB", (w, h), bg)
            d = ImageDraw.Draw(im)
            for _ in range(rng.randint(4, 12)):
                x0, y0 = rng.randint(0, w - 50), rng.randint(0, h - 50)
                d.rounded_rectangle([x0, y0, x0 + rng.randint(40, w // 2), y0 + rng.randint(30, h // 6)],
                                    radius=rng.randint(0, 24), fill=tuple(rng.randint(0, 255) for _ in range(3)))
                d.text((x0 + 8, y0 + 8), rng.choice(words), fill=(255 - bg[0], 255 - bg[1], 255 - bg[2]))
        elif kind == 2:  # flat colour or gradient (a covered lens, a wall)
            a = np.array([rng.randint(0, 255) for _ in range(3)], np.float32)
            b = np.array([rng.randint(0, 255) for _ in range(3)], np.float32)
            t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
            arr = np.repeat(a + (b - a) * t, w, axis=1) if rng.random() < 0.6 else np.full((h, w, 3), a)
            im = Image.fromarray(arr.astype(np.uint8))
        else:  # sensor noise / very dark photo
            nrng = np.random.default_rng(seed + i)
            arr = nrng.normal(rng.randint(5, 200), rng.randint(5, 60), (h // 4, w // 4, 3)).clip(0, 255)
            im = Image.fromarray(arr.astype(np.uint8)).resize((w, h))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=rng.randint(60, 95))
        yield "synthetic", buf.getvalue()


@torch.no_grad()
def features(model, xs: list[np.ndarray]) -> np.ndarray:
    x = torch.from_numpy(np.stack(xs))
    return model.forward_head(model.forward_features(x), pre_logits=True).numpy()


def extract(model, items, pcfg: PreprocessConfig, batch: int = 64, label: str = "") -> tuple[np.ndarray, list]:
    feats, kept, buf, meta = [], [], [], []
    t0 = time.time()
    for n, (tag, data) in enumerate(items, 1):
        try:
            buf.append(preprocess_eval(load_image(data), pcfg))
            meta.append(tag)
        except Exception:  # unreadable file in a public dataset: skip it
            continue
        if len(buf) == batch:
            feats.append(features(model, buf))
            kept += meta
            buf, meta = [], []
        if n % 2000 == 0:
            print(f"  {label}: {n} images, {time.time() - t0:.0f}s", flush=True)
    if buf:
        feats.append(features(model, buf))
        kept += meta
    return np.concatenate(feats), kept


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--prepared", default="data/prepared")
    ap.add_argument("--negatives", default="data/negatives")
    ap.add_argument("--train-positives", type=int, default=8000, help="CCMT train photos used to fit")
    args = ap.parse_args()

    from sklearn.linear_model import LogisticRegression

    run, neg_root, prepared = Path(args.run), Path(args.negatives), Path(args.prepared)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    model, ck = load_checkpoint(run)
    pcfg = PreprocessConfig.from_dict(ck["preprocess"])
    cache = run / "leaf_gate_features.npz"

    download(neg_root)
    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        X = {k: z[f"X_{k}"] for k in ("train", "val", "test")}
        Y = {k: z[f"Y_{k}"] for k in ("train", "val", "test")}
        T = {k: list(z[f"T_{k}"]) for k in ("train", "val", "test")}
    else:
        rows, _ = read_splits(prepared)
        pos = {s: [r for r in rows if r["split"] == s] for s in ("train", "val", "test")}
        step = max(1, len(pos["train"]) // args.train_positives)
        pos["train"] = pos["train"][::step]
        neg = {"train": [], "val": [], "test": []}
        for tag, data in [*imagenette(neg_root), *caltech(neg_root), *synthetic()]:
            neg[_split_of(data)].append((tag, data))
        X, Y, T = {}, {}, {}
        for s in ("train", "val", "test"):
            items = ((r["label"], (prepared / r["cache"]).read_bytes()) for r in pos[s])
            fp, tp = extract(model, items, pcfg, label=f"{s} leaves")
            fn, tn = extract(model, neg[s], pcfg, label=f"{s} not leaves")
            X[s] = np.concatenate([fp, fn]).astype(np.float32)
            Y[s] = np.concatenate([np.ones(len(fp)), np.zeros(len(fn))]).astype(np.int8)
            T[s] = tp + tn
            print(f"{s}: {len(fp)} leaves, {len(fn)} not leaves", flush=True)
        np.savez_compressed(cache, **{f"X_{k}": v for k, v in X.items()}, **{f"Y_{k}": v for k, v in Y.items()},
                            **{f"T_{k}": np.array(v, dtype=object) for k, v in T.items()})

    # Standardise, fit, then fold the scaling into one linear layer for the ONNX graph.
    mu, sd = X["train"].mean(0), X["train"].std(0) + 1e-6
    z = {k: (v - mu) / sd for k, v in X.items()}
    best = None
    for c in (0.001, 0.01, 0.1, 1.0):
        clf = LogisticRegression(C=c, max_iter=3000, class_weight="balanced")
        clf.fit(z["train"], Y["train"])
        p = clf.predict_proba(z["val"])[:, 1]
        thr = float(np.quantile(p[Y["val"] == 1], 1 - LEAF_RECALL))
        reject = float((p[Y["val"] == 0] < thr).mean())
        print(f"C={c}: val rejects {reject:.4f} of non-leaves at {LEAF_RECALL:.0%} leaf recall", flush=True)
        if best is None or reject > best[0]:
            best = (reject, c, clf, thr)
    _, c, clf, thr = best
    w = clf.coef_[0] / sd
    b = float(clf.intercept_[0] - (clf.coef_[0] * mu / sd).sum())

    def score(x):
        return 1 / (1 + np.exp(-(x @ w + b)))

    def report(split):
        p, y, tags = score(X[split]), Y[split], np.array(T[split])
        out = {"leaf_recall": float((p[y == 1] >= thr).mean()),
               "not_leaf_rejected": float((p[y == 0] < thr).mean()),
               "n_leaves": int((y == 1).sum()), "n_not_leaves": int((y == 0).sum()),
               "not_leaf_rejected_by_source": {}, "leaf_recall_by_crop": {}}
        for src in ("imagenette", "caltech101", "synthetic"):
            m = (y == 0) & (tags == src)
            if m.any():
                out["not_leaf_rejected_by_source"][src] = float((p[m] < thr).mean())
        for crop in ("cashew", "cassava", "maize", "tomato"):
            m = (y == 1) & np.char.startswith(tags.astype(str), crop)
            if m.any():
                out["leaf_recall_by_crop"][crop] = float((p[m] >= thr).mean())
        return out

    gate = {
        "feature_dim": int(w.shape[0]),
        "weights": [float(v) for v in w],
        "bias": b,
        "threshold": thr,
        "rule": (f"threshold = the score that accepts {LEAF_RECALL:.0%} of validation leaves; "
                 "C chosen on validation; test reported only"),
        "C": c,
        "validation": report("val"),
        "test": report("test"),
        "negatives": SOURCES | {"synthetic": "generated documents, screenshots, flat colours and noise",
                                "caltech101_excluded": sorted(CALTECH_PLANTS)},
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (run / "leaf_gate.json").write_text(json.dumps(gate, indent=2))
    print(json.dumps({k: gate[k] for k in ("threshold", "C", "validation", "test")}, indent=2))


if __name__ == "__main__":
    main()
