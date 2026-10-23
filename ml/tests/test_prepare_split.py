"""End-to-end test of prepare.py on a synthetic dataset with planted duplicates."""
import csv
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from cropguard_ml import prepare


def _make(path: Path, seed: int, size=(320, 240)):
    rng = np.random.default_rng(seed)
    arr = (rng.random((size[1] // 16, size[0] // 16, 3)) * 255).astype(np.uint8)
    img = Image.fromarray(arr).resize(size, Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=92)


def test_prepare_has_no_leakage(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    seed = 0
    for crop, cls in [("Cashew", "gumosis"), ("Cashew", "healthy"), ("Maize", "grasshoper")]:
        for i in range(20):
            seed += 1
            _make(raw / crop / cls / f"{cls}{i}.jpg", seed)
    # exact duplicate within class
    shutil.copy(raw / "Cashew/healthy/healthy0.jpg", raw / "Cashew/healthy/healthy0_copy.jpg")
    # label conflict: same file in two classes -> both dropped
    shutil.copy(raw / "Maize/grasshoper/grasshoper3.jpg", raw / "Cashew/gumosis/conflict.jpg")
    # near duplicate (resized copy) within class -> grouped
    Image.open(raw / "Cashew/gumosis/gumosis5.jpg").resize((300, 225)).save(
        raw / "Cashew/gumosis/gumosis5_small.jpg", "JPEG", quality=80)
    # corrupt file
    (raw / "Cashew/healthy/broken.jpg").write_bytes(b"\xff\xd8 broken")

    out = tmp_path / "prepared"
    monkeypatch.setattr(sys, "argv", ["prepare", "--raw", str(raw), "--out", str(out),
                                      "--workers", "1", "--cache-size", "64"])
    prepare.main()

    rep = json.loads((out / "dataset_report.json").read_text())
    assert rep["corrupt_or_undecodable"] == 1
    assert rep["exact_duplicates_dropped_same_class"] == 1
    assert rep["label_conflict_images_dropped"] == 2
    assert rep["near_dup_pairs_within_class"] >= 1
    assert rep["num_classes"] == 3

    with open(out / "splits.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    groups: dict[str, set] = {}
    for r in rows:
        groups.setdefault(r["group"], set()).add(r["split"])
        assert (out / r["cache"]).exists()
    assert all(len(s) == 1 for s in groups.values())
    g5 = {r["group"] for r in rows if "gumosis5" in r["rel"]}
    assert len(g5) == 1  # near-duplicates share a group
    assert {r["split"] for r in rows} == {"train", "val", "test"}
    c2i = json.loads((out / "class_to_idx.json").read_text())
    assert c2i == {"cashew_gummosis": 0, "cashew_healthy": 1, "maize_grasshopper": 2}
