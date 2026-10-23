"""Inspect, clean and split the raw CCMT images without leakage.

Steps
1. Walk data/raw/<Crop>/<class>/ and resolve each folder via labels.from_source.
2. Decode every image (EXIF-aware). Corrupt/undecodable files are recorded and excluded.
3. Exact duplicates: identical SHA-256.
   - same class  -> kept once
   - different classes (label conflict) -> all copies excluded
4. Near duplicates: 64-bit difference hash (dHash) on the decoded image.
   Images within the same class whose hashes differ by <= --near-dup-bits are
   joined into one group (union-find). Cross-class near-duplicates are reported.
5. Group-aware stratified split (default 70/15/15). A group never spans splits,
   so re-shots/crops of the same leaf cannot leak into validation or test.
6. Write a resized cache (shorter side = --cache-size) to speed up CPU training.
   The cache uses preprocess.resize_short_side, the same function used at inference.
7. Write reports: splits.csv, class_to_idx.json, dataset_report.json,
   class_distribution.png.

    python -m cropguard_ml.prepare --raw data/raw --out data/prepared
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

from . import labels
from .preprocess import InvalidImageError, load_image, resize_short_side

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def dhash64(img: Image.Image) -> int:
    g = img.convert("L").resize((9, 8), Image.BILINEAR)
    a = np.asarray(g, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def _process(args) -> dict:
    path, cache_path, cache_size = args
    rec = {"path": str(path)}
    try:
        data = Path(path).read_bytes()
        rec["sha256"] = hashlib.sha256(data).hexdigest()
        img = load_image(data)
        rec["width"], rec["height"] = img.size
        rec["dhash"] = dhash64(img)
        if cache_path is not None:
            cp = Path(cache_path)
            if not cp.exists():
                cp.parent.mkdir(parents=True, exist_ok=True)
                resize_short_side(img, cache_size).save(cp, "JPEG", quality=95)
        rec["ok"] = True
    except (InvalidImageError, OSError) as exc:
        rec["ok"] = False
        rec["error"] = str(exc)
    return rec


class UnionFind:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def popcount64(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.uint64)
    c = np.zeros(x.shape, dtype=np.uint8)
    for shift in range(0, 64, 8):
        c += _POP8[((x >> np.uint64(shift)) & np.uint64(0xFF)).astype(np.uint8)]
    return c


_POP8 = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def near_dup_pairs(hashes: np.ndarray, max_bits: int) -> list[tuple[int, int]]:
    pairs = []
    for i in range(len(hashes) - 1):
        d = popcount64(np.bitwise_xor(hashes[i + 1:], hashes[i]))
        for j in np.nonzero(d <= max_bits)[0]:
            pairs.append((i, i + 1 + int(j)))
    return pairs


def group_split(groups_by_class: dict[str, list[list[int]]], ratios, seed: int) -> dict[int, str]:
    """Assign whole groups to splits so each class approximates the ratios."""
    rng = random.Random(seed)
    names = ("train", "val", "test")
    assign: dict[int, str] = {}
    for cls in sorted(groups_by_class):
        groups = groups_by_class[cls][:]
        rng.shuffle(groups)
        groups.sort(key=len, reverse=True)  # place big groups first (stable after shuffle)
        total = sum(len(g) for g in groups)
        target = {n: r * total for n, r in zip(names, ratios, strict=True)}
        filled = {n: 0 for n in names}
        for g in groups:
            # pick split with the largest remaining deficit (relative to target)
            n = max(names, key=lambda s: (target[s] - filled[s]) / max(target[s], 1e-9))
            filled[n] += len(g)
            for i in g:
                assign[i] = n
    return assign


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/prepared")
    ap.add_argument("--cache-size", type=int, default=288)
    ap.add_argument("--near-dup-bits", type=int, default=4)
    ap.add_argument("--ratios", default="0.70,0.15,0.15")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--workers", type=int, default=0)
    args = ap.parse_args()

    raw, out = Path(args.raw), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cache_root = out / f"cache_{args.cache_size}"
    ratios = tuple(float(x) for x in args.ratios.split(","))
    assert abs(sum(ratios) - 1) < 1e-6

    items = []
    unknown_folders = []
    for crop_dir in sorted(p for p in raw.iterdir() if p.is_dir()):
        for cls_dir in sorted(p for p in crop_dir.iterdir() if p.is_dir()):
            try:
                ci = labels.from_source(crop_dir.name, cls_dir.name)
            except KeyError:
                unknown_folders.append(f"{crop_dir.name}/{cls_dir.name}")
                continue
            for f in sorted(cls_dir.iterdir()):
                if f.suffix.lower() in IMG_EXT:
                    rel = f.relative_to(raw)
                    items.append({"rel": str(rel).replace("\\", "/"), "label": ci.key,
                                  "abs": f, "cache": cache_root / rel.with_suffix(".jpg")})
    print(f"Found {len(items)} image files; unknown folders: {unknown_folders}")

    workers = args.workers or max(1, (__import__("os").cpu_count() or 2))
    jobs = [(it["abs"], it["cache"], args.cache_size) for it in items]
    results = [None] * len(items)
    with cf.ProcessPoolExecutor(workers) as ex:
        for i, r in enumerate(ex.map(_process, jobs, chunksize=32)):
            results[i] = r
            if (i + 1) % 2000 == 0:
                print(f"  decoded {i + 1}/{len(items)}", flush=True)

    corrupt = [items[i]["rel"] for i, r in enumerate(results) if not r["ok"]]
    good = [i for i, r in enumerate(results) if r["ok"]]

    # exact duplicates
    by_sha: dict[str, list[int]] = defaultdict(list)
    for i in good:
        by_sha[results[i]["sha256"]].append(i)
    conflict_drop, dup_drop = set(), set()
    exact_dup_sets = 0
    for idxs in by_sha.values():
        if len(idxs) < 2:
            continue
        exact_dup_sets += 1
        cls = {items[i]["label"] for i in idxs}
        if len(cls) > 1:
            conflict_drop.update(idxs)
        else:
            dup_drop.update(idxs[1:])
    keep = [i for i in good if i not in conflict_drop and i not in dup_drop]

    # near duplicates within class -> groups
    uf = UnionFind(len(items))
    near_pairs_within = 0
    by_class: dict[str, list[int]] = defaultdict(list)
    for i in keep:
        by_class[items[i]["label"]].append(i)
    for idxs in by_class.values():
        hs = np.array([results[i]["dhash"] for i in idxs], dtype=np.uint64)
        for a, b in near_dup_pairs(hs, args.near_dup_bits):
            uf.union(idxs[a], idxs[b])
            near_pairs_within += 1
    # cross-class near-dup report (not merged; reported for transparency)
    all_h = np.array([results[i]["dhash"] for i in keep], dtype=np.uint64)
    cross = [(keep[a], keep[b]) for a, b in near_dup_pairs(all_h, args.near_dup_bits)
             if items[keep[a]]["label"] != items[keep[b]]["label"]]

    groups_by_class: dict[str, list[list[int]]] = defaultdict(list)
    tmp: dict[int, list[int]] = defaultdict(list)
    for i in keep:
        tmp[uf.find(i)].append(i)
    for root, members in tmp.items():
        groups_by_class[items[root]["label"]].append(sorted(members))

    assign = group_split(groups_by_class, ratios, args.seed)

    # leakage assertions
    group_of = {i: uf.find(i) for i in keep}
    split_of_group: dict[int, set] = defaultdict(set)
    for i in keep:
        split_of_group[group_of[i]].add(assign[i])
    assert all(len(s) == 1 for s in split_of_group.values()), "group spans splits"
    sha_split = defaultdict(set)
    for i in keep:
        sha_split[results[i]["sha256"]].add(assign[i])
    assert all(len(s) == 1 for s in sha_split.values()), "duplicate spans splits"

    keys = sorted({items[i]["label"] for i in keep})
    c2i = labels.class_to_index(keys)
    (out / "class_to_idx.json").write_text(json.dumps(c2i, indent=2))
    (out / "classes.json").write_text(json.dumps(
        [labels.CLASSES[k].to_dict() | {"index": c2i[k]} for k in keys], indent=2))

    with open(out / "splits.csv", "w", encoding="utf-8") as fh:
        fh.write("rel,cache,label,split,group,sha256,width,height\n")
        for i in keep:
            it, r = items[i], results[i]
            cache_rel = str(it["cache"].relative_to(out)).replace("\\", "/")
            fh.write(f"\"{it['rel']}\",\"{cache_rel}\",{it['label']},{assign[i]},"
                     f"{group_of[i]},{r['sha256']},{r['width']},{r['height']}\n")

    dist = {s: Counter(items[i]["label"] for i in keep if assign[i] == s)
            for s in ("train", "val", "test")}
    sizes = Counter(f"{results[i]['width']}x{results[i]['height']}" for i in good)
    report = {
        "raw_files_found": len(items),
        "unknown_folders": unknown_folders,
        "corrupt_or_undecodable": len(corrupt),
        "corrupt_files": corrupt[:200],
        "exact_duplicate_sets": exact_dup_sets,
        "exact_duplicates_dropped_same_class": len(dup_drop),
        "label_conflict_images_dropped": len(conflict_drop),
        "near_dup_threshold_bits": args.near_dup_bits,
        "near_dup_pairs_within_class": near_pairs_within,
        "near_dup_pairs_cross_class": len(cross),
        "cross_class_examples": [[items[a]["rel"], items[b]["rel"]] for a, b in cross[:30]],
        "images_kept": len(keep),
        "groups": len(tmp),
        "groups_larger_than_one": sum(1 for m in tmp.values() if len(m) > 1),
        "ratios": ratios,
        "seed": args.seed,
        "cache_size": args.cache_size,
        "num_classes": len(keys),
        "per_class": {k: {s: dist[s].get(k, 0) for s in dist} for k in keys},
        "split_totals": {s: sum(dist[s].values()) for s in dist},
        "top_image_sizes": sizes.most_common(10),
    }
    (out / "dataset_report.json").write_text(json.dumps(report, indent=2))
    _plot_distribution(report, out / "class_distribution.png")
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ("per_class", "corrupt_files", "cross_class_examples")}, indent=2))


def _plot_distribution(report: dict, path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    keys = list(report["per_class"])
    tr = [report["per_class"][k]["train"] for k in keys]
    va = [report["per_class"][k]["val"] for k in keys]
    te = [report["per_class"][k]["test"] for k in keys]
    fig, ax = plt.subplots(figsize=(12, 6))
    y = np.arange(len(keys))
    ax.barh(y, tr, color="#2f6b3a", label="train")
    ax.barh(y, va, left=tr, color="#c9a227", label="val")
    ax.barh(y, te, left=np.array(tr) + np.array(va), color="#8a3b12", label="test")
    ax.set_yticks(y, [labels.CLASSES[k].crop.title() + " · " + labels.CLASSES[k].display_name
                      for k in keys])
    ax.invert_yaxis()
    ax.set_xlabel("images")
    ax.set_title("CCMT raw images per class after cleaning (group-aware split)")
    ax.legend(frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
