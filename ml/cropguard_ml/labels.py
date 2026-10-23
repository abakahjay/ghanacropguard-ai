"""Class registry for the CCMT (Cashew, Cassava, Maize, Tomato) dataset.

The source folder names on Mendeley Data contain spelling variants
("gumosis", "grasshoper", "verticulium wilt"). We keep the *source* folder
name as the provenance label and map it to a stable canonical key plus a
correctly spelled display name. The canonical key is what the model and the
API use; the class-to-index mapping is generated from the sorted canonical
keys of the classes that actually have images, and saved alongside the model.

Verified against the Mendeley public API (dataset bwh3zbpkpv, version 1,
folder "Raw Data/CCMT Dataset") on 2026-10-22: 4 crops, 22 class folders.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ClassInfo:
    key: str            # canonical key, e.g. "cashew_gummosis"
    crop: str           # "cashew" | "cassava" | "maize" | "tomato"
    source_folder: str  # folder name exactly as published
    display_name: str   # human-readable, correctly spelled
    kind: str           # "disease" | "pest" | "healthy"

    def to_dict(self) -> dict:
        return asdict(self)


_RAW: list[tuple[str, str, str, str]] = [
    # crop, source folder, display name, kind
    ("cashew", "anthracnose", "Anthracnose", "disease"),
    ("cashew", "gumosis", "Gummosis", "disease"),
    ("cashew", "healthy", "Healthy", "healthy"),
    ("cashew", "leaf miner", "Leaf miner", "pest"),
    ("cashew", "red rust", "Red rust", "disease"),
    ("cassava", "bacterial blight", "Bacterial blight", "disease"),
    ("cassava", "brown spot", "Brown spot", "disease"),
    ("cassava", "green mite", "Green mite", "pest"),
    ("cassava", "healthy", "Healthy", "healthy"),
    ("cassava", "mosaic", "Mosaic", "disease"),
    ("maize", "fall armyworm", "Fall armyworm", "pest"),
    ("maize", "grasshoper", "Grasshopper", "pest"),
    ("maize", "healthy", "Healthy", "healthy"),
    ("maize", "leaf beetle", "Leaf beetle", "pest"),
    ("maize", "leaf blight", "Leaf blight", "disease"),
    ("maize", "leaf spot", "Leaf spot", "disease"),
    ("maize", "streak virus", "Streak virus", "disease"),
    ("tomato", "healthy", "Healthy", "healthy"),
    ("tomato", "leaf blight", "Leaf blight", "disease"),
    ("tomato", "leaf curl", "Leaf curl", "disease"),
    ("tomato", "septoria leaf spot", "Septoria leaf spot", "disease"),
    ("tomato", "verticulium wilt", "Verticillium wilt", "disease"),
]

CROPS = ("cashew", "cassava", "maize", "tomato")


def _key(crop: str, display: str) -> str:
    return f"{crop}_{display.lower().replace(' ', '_')}"


CLASSES: dict[str, ClassInfo] = {
    _key(c, d): ClassInfo(_key(c, d), c, s, d, k) for c, s, d, k in _RAW
}

_BY_SOURCE = {(ci.crop, ci.source_folder.lower()): ci for ci in CLASSES.values()}


def from_source(crop_folder: str, class_folder: str) -> ClassInfo:
    """Resolve a published folder pair (e.g. 'Cashew', 'gumosis') to a ClassInfo."""
    k = (crop_folder.strip().lower(), class_folder.strip().lower())
    if k not in _BY_SOURCE:
        raise KeyError(f"Unknown source class folder: {crop_folder}/{class_folder}")
    return _BY_SOURCE[k]


def class_to_index(keys: list[str]) -> dict[str, int]:
    """Deterministic mapping: sorted canonical keys -> contiguous indices."""
    for k in keys:
        if k not in CLASSES:
            raise KeyError(k)
    return {k: i for i, k in enumerate(sorted(set(keys)))}
