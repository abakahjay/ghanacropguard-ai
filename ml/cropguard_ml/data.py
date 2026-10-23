from __future__ import annotations

import csv
import json
from pathlib import Path

from PIL import Image
from torch.utils.data import Dataset


def read_splits(prepared: str | Path) -> tuple[list[dict], dict[str, int]]:
    prepared = Path(prepared)
    with open(prepared / "splits.csv", newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    c2i = json.loads((prepared / "class_to_idx.json").read_text())
    return rows, c2i


class CCMTDataset(Dataset):
    """Reads the resized cache produced by prepare.py."""

    def __init__(self, prepared: str | Path, split: str, transform, limit_per_class: int = 0):
        self.root = Path(prepared)
        rows, self.class_to_idx = read_splits(prepared)
        rows = [r for r in rows if r["split"] == split]
        if limit_per_class:
            seen: dict[str, int] = {}
            kept = []
            for r in rows:
                if seen.get(r["label"], 0) < limit_per_class:
                    kept.append(r)
                    seen[r["label"]] = seen.get(r["label"], 0) + 1
            rows = kept
        self.rows = rows
        self.targets = [self.class_to_idx[r["label"]] for r in rows]
        self.transform = transform

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int):
        r = self.rows[i]
        with Image.open(self.root / r["cache"]) as im:
            img = im.convert("RGB")
        return self.transform(img), self.targets[i]
