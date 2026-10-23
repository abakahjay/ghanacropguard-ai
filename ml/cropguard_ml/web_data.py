"""Write the dataset summary the web landing page shows (web/src/data/dataset.json).

Counts are the RAW images as published (from the download provenance), grouped by crop and class,
and they are asserted to sum to the total. Nothing is typed in by hand.

    python -m cropguard_ml.web_data --raw data/raw --web ../web
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from . import labels


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--prepared", default="data/prepared")
    ap.add_argument("--web", default="../web")
    args = ap.parse_args()

    prov = json.loads((Path(args.raw) / "PROVENANCE.json").read_text())
    counts = prov.get("zip_raw_counts") or prov.get("expected_counts")
    if not counts:
        raise SystemExit("No per-class counts in PROVENANCE.json; run the download stages first.")
    crops: dict[str, list] = defaultdict(list)
    for key, n in counts.items():
        crop_folder, cls_folder = key.split("/")
        ci = labels.from_source(crop_folder, cls_folder)
        crops[ci.crop].append({"key": ci.key, "name": ci.display_name, "images": int(n)})
    out_crops = []
    for c in labels.CROPS:
        cls = sorted(crops.get(c, []), key=lambda x: -x["images"])
        out_crops.append({"crop": c, "name": c.title(), "images": sum(x["images"] for x in cls), "classes": cls})
    total = sum(c["images"] for c in out_crops)
    assert total == sum(int(v) for v in counts.values())

    rep_p = Path(args.prepared) / "dataset_report.json"
    rep = json.loads(rep_p.read_text()) if rep_p.exists() else None
    data = {
        "source": "Mendeley Data bwh3zbpkpv v1, raw images (counts from the download provenance)",
        "cleaned": False,
        "total": total,
        "crops": out_crops,
        "after_cleaning": None if rep is None else {
            "images_kept": rep["images_kept"], "split_totals": rep["split_totals"],
            "corrupt": rep["corrupt_or_undecodable"],
            "exact_duplicates_removed": rep["exact_duplicates_dropped_same_class"],
            "label_conflicts_removed": rep["label_conflict_images_dropped"]},
    }
    dst = Path(args.web) / "src" / "data" / "dataset.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(data, indent=2))
    print(json.dumps({"total": total, "per_crop": {c["crop"]: c["images"] for c in out_crops}}, indent=2))


if __name__ == "__main__":
    main()
