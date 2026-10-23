"""Produce the landing page's demo reel from REAL model outputs.

Picks a few CCMT *test-split* photos (one per requested class), runs them through the
exported ONNX bundle with the same preprocessing as the API, and writes:
  web/public/samples/<class_key>.jpg   (resized to 960px long side, EXIF stripped)
  web/src/data/samples.json            (the model's actual top-3 output + credit)
Nothing here is hand-written: if the model is wrong on a sample, the page shows it wrong.

    python -m cropguard_ml.demo_samples --bundle ../artifacts/models/active
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image

from . import labels
from .data import read_splits
from .preprocess import PreprocessConfig, load_image, preprocess_eval

DEFAULT = ["cassava_mosaic", "maize_fall_armyworm", "cashew_anthracnose", "tomato_leaf_curl"]
CREDIT = ("Photo: CCMT dataset (Mensah et al., 2023), Mendeley Data, "
          "doi:10.17632/bwh3zbpkpv.1, CC BY 4.0")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default="../artifacts/models/active")
    ap.add_argument("--prepared", default="data/prepared")
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--classes", nargs="*", default=DEFAULT)
    ap.add_argument("--web", default="../web")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    import onnxruntime as ort

    bundle = Path(args.bundle)
    meta = json.loads((bundle / "meta.json").read_text())
    cfg = PreprocessConfig.from_dict(meta["preprocess"])
    classes = sorted(meta["classes"], key=lambda c: c["index"])
    sess = ort.InferenceSession(str(bundle / "model.onnx"), providers=["CPUExecutionProvider"])
    rows, _ = read_splits(args.prepared)
    rng = random.Random(args.seed)

    out_img = Path(args.web) / "public" / "samples"
    out_img.mkdir(parents=True, exist_ok=True)
    samples = []
    for key in args.classes:
        cands = [r for r in rows if r["split"] == "test" and r["label"] == key]
        if not cands:
            print(f"skip {key}: no test images")
            continue
        r = rng.choice(cands)
        img = load_image(str(Path(args.raw) / r["rel"]))
        x = preprocess_eval(img, cfg)[None]
        logits = sess.run(None, {"input": x})[0][0].astype(np.float64)
        p = np.exp(logits - logits.max())
        p /= p.sum()
        top = [{"class_key": classes[i]["key"], "display_name": classes[i]["display_name"],
                "crop": classes[i]["crop"], "confidence": round(float(p[i]), 4)}
               for i in np.argsort(-p)[:3]]
        im = img.copy()
        im.thumbnail((960, 960), Image.LANCZOS)
        im.save(out_img / f"{key}.jpg", "JPEG", quality=84, optimize=True)
        ci = labels.CLASSES[key]
        samples.append({
            "file": f"/samples/{key}.jpg", "width": im.width, "height": im.height,
            "true_label": {"class_key": key, "display_name": ci.display_name, "crop": ci.crop},
            "source_file": r["rel"], "model": meta["name"], "top3": top,
            "correct": top[0]["class_key"] == key, "credit": CREDIT,
        })
        print(key, "->", top[0]["class_key"], top[0]["confidence"])
    data_dir = Path(args.web) / "src" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "samples.json").write_text(json.dumps({"model": meta["name"], "samples": samples}, indent=2))


if __name__ == "__main__":
    main()
