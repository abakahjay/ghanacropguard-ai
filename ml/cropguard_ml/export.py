"""Export a trained checkpoint into a versioned, self-describing model bundle.

    python -m cropguard_ml.export --run runs/mobilenetv3 --version 1.0.0 --out ../artifacts/models

Bundle layout (artifacts/models/<arch>-<version>/):
  model.onnx            float32 ONNX (opset 17), input "input" [N,3,H,W], output "logits"
  model.int8.onnx       optional dynamically-quantised copy (for mobile / small servers)
  meta.json             classes, preprocessing, metrics, provenance, file hashes
The ONNX output is checked against PyTorch on real validation images.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch

from . import labels
from .data import read_splits
from .evaluate import load_checkpoint
from .preprocess import PreprocessConfig, load_image, preprocess_eval


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--version", required=True)
    ap.add_argument("--out", default="../artifacts/models")
    ap.add_argument("--prepared", default="data/prepared")
    ap.add_argument("--quantize", action="store_true")
    args = ap.parse_args()

    run = Path(args.run)
    model, ck = load_checkpoint(run)
    pcfg = PreprocessConfig.from_dict(ck["preprocess"])
    name = f"{ck['arch'].split('.')[0]}-{args.version}"
    out = Path(args.out) / name
    out.mkdir(parents=True, exist_ok=True)

    dummy = torch.randn(1, 3, pcfg.image_size, pcfg.image_size)
    onnx_path = out / "model.onnx"
    torch.onnx.export(model, dummy, onnx_path, input_names=["input"], output_names=["logits"],
                      dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, dynamo=False)

    import onnxruntime as ort

    # parity check on real validation images (never test images)
    rows, _ = read_splits(args.prepared)
    val = [r for r in rows if r["split"] == "val"][:: max(1, len(rows) // 400)][:32]
    xs = np.stack([preprocess_eval(load_image(str(Path(args.prepared) / r["cache"])), pcfg) for r in val])
    with torch.no_grad():
        ref = model(torch.from_numpy(xs)).numpy()
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    got = sess.run(["logits"], {"input": xs})[0]
    max_diff = float(np.abs(ref - got).max())
    agree = float((ref.argmax(1) == got.argmax(1)).mean())
    if agree < 1.0 or max_diff > 1e-3:
        raise SystemExit(f"ONNX parity failed: max_diff={max_diff} agree={agree}")

    files = {"model.onnx": {"sha256": _sha(onnx_path), "bytes": onnx_path.stat().st_size}}
    quant = None
    if args.quantize:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        qpath = out / "model.int8.onnx"
        quantize_dynamic(str(onnx_path), str(qpath), weight_type=QuantType.QUInt8)
        qs = ort.InferenceSession(str(qpath), providers=["CPUExecutionProvider"])
        qgot = qs.run(["logits"], {"input": xs})[0]
        quant = {"argmax_agreement_vs_fp32_on_val_sample": float((qgot.argmax(1) == ref.argmax(1)).mean())}
        files["model.int8.onnx"] = {"sha256": _sha(qpath), "bytes": qpath.stat().st_size}

    idx_to_key = {v: k for k, v in ck["class_to_idx"].items()}
    classes = [labels.CLASSES[idx_to_key[i]].to_dict() | {"index": i} for i in range(len(idx_to_key))]

    def _maybe(p):
        p = run / p
        return json.loads(p.read_text()) if p.exists() else None

    test = _maybe("test_metrics.json")
    prov_path = Path(args.prepared).parent / "raw" / "PROVENANCE.json"
    meta = {
        "name": name,
        "version": args.version,
        "arch": ck["arch"],
        "framework": f"torch {torch.__version__} -> onnx opset 17",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input": {"name": "input", "layout": "NCHW", "dtype": "float32"},
        "output": {"name": "logits", "activation": "none (apply softmax)"},
        "preprocess": pcfg.to_dict(),
        "classes": classes,
        "num_classes": len(classes),
        "onnx_parity": {"max_abs_logit_diff": max_diff, "argmax_agreement": agree,
                        "n_val_images": len(val)},
        "quantized": quant,
        "validation_best": ck.get("best"),
        "test_metrics": None if test is None else {
            k: test[k] for k in ("n_images", "accuracy", "top3_accuracy", "precision_macro",
                                 "recall_macro", "f1_macro", "f1_weighted", "ece_15bin", "latency_cpu")},
        "dataset": json.loads(prov_path.read_text()) if prov_path.exists() else None,
        "files": files,
        "intended_use": ("Preliminary visual screening aid for 22 CCMT classes of cashew, cassava, "
                         "maize and tomato. Not a diagnosis. Outputs are only meaningful for those crops."),
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps({"bundle": str(out), "parity": meta["onnx_parity"], "quantized": quant}, indent=2))


if __name__ == "__main__":
    main()
