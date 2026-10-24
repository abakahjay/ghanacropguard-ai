"""Model construction, a tiny training step, checkpoint -> ONNX export and parity."""
import json
import sys

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("timm")
ort = pytest.importorskip("onnxruntime")

from cropguard_ml.train import create_model, head_parameters, set_backbone_trainable  # noqa: E402


def test_model_forward_shape():
    m = create_model("mobilenetv3_large_100", 22, pretrained=False).eval()
    with torch.no_grad():
        y = m(torch.randn(2, 3, 224, 224))
    assert y.shape == (2, 22)


def test_backbone_freezing_leaves_only_head_trainable():
    m = create_model("mobilenetv3_large_100", 5, pretrained=False)
    set_backbone_trainable(m, False)
    trainable = {id(p) for p in m.parameters() if p.requires_grad}
    assert trainable == {id(p) for p in head_parameters(m)}


def test_export_bundle_parity(tmp_path, monkeypatch):
    from test_prepare_split import _make

    from cropguard_ml import export, prepare
    from cropguard_ml.preprocess import PreprocessConfig

    raw = tmp_path / "raw"
    for k, (crop, cls) in enumerate([("Cashew", "healthy"), ("Maize", "grasshoper")]):
        for i in range(10):
            _make(raw / crop / cls / f"{i}.jpg", 100 * k + i)
    prepared = tmp_path / "prepared"
    monkeypatch.setattr(sys, "argv", ["p", "--raw", str(raw), "--out", str(prepared), "--workers", "1"])
    prepare.main()

    run = tmp_path / "runs" / "t"
    run.mkdir(parents=True)
    m = create_model("mobilenetv3_large_100", 2, pretrained=False).eval()
    c2i = json.loads((prepared / "class_to_idx.json").read_text())
    torch.save({"state_dict": m.state_dict(), "arch": "mobilenetv3_large_100", "num_classes": 2,
                "class_to_idx": c2i, "preprocess": PreprocessConfig().to_dict(), "config": {},
                "best": {"macro_f1": 0.0}}, run / "best.pt")
    out = tmp_path / "models"
    monkeypatch.setattr(sys, "argv", ["e", "--run", str(run), "--version", "0.0.1",
                                      "--out", str(out), "--prepared", str(prepared), "--quantize"])
    export.main()
    bundle = out / "mobilenetv3_large_100-0.0.1"
    meta = json.loads((bundle / "meta.json").read_text())
    assert meta["num_classes"] == 2
    assert [c["key"] for c in meta["classes"]] == ["cashew_healthy", "maize_grasshopper"]
    assert meta["onnx_parity"]["argmax_agreement"] == 1.0
    sess = ort.InferenceSession(str(bundle / "model.onnx"))
    out_ = sess.run(None, {"input": np.zeros((1, 3, 224, 224), np.float32)})[0]
    assert out_.shape == (1, 2)


def test_export_with_leaf_gate_adds_leaf_score(tmp_path, monkeypatch):
    """A run with leaf_gate.json exports a second output, leaf_score, matching the fitted linear head."""
    from test_prepare_split import _make

    from cropguard_ml import export, prepare
    from cropguard_ml.preprocess import PreprocessConfig

    raw = tmp_path / "raw"
    for k, (crop, cls) in enumerate([("Cashew", "healthy"), ("Maize", "grasshoper")]):
        for i in range(10):
            _make(raw / crop / cls / f"{i}.jpg", 100 * k + i)
    prepared = tmp_path / "prepared"
    monkeypatch.setattr(sys, "argv", ["p", "--raw", str(raw), "--out", str(prepared), "--workers", "1"])
    prepare.main()

    run = tmp_path / "runs" / "t"
    run.mkdir(parents=True)
    m = create_model("mobilenetv3_large_100", 2, pretrained=False).eval()
    torch.save({"state_dict": m.state_dict(), "arch": "mobilenetv3_large_100", "num_classes": 2,
                "class_to_idx": json.loads((prepared / "class_to_idx.json").read_text()),
                "preprocess": PreprocessConfig().to_dict(), "config": {}, "best": {"macro_f1": 0.0}}, run / "best.pt")
    rng = np.random.default_rng(0)
    w = rng.normal(0, 0.01, 1280)
    gate = {"feature_dim": 1280, "weights": w.tolist(), "bias": 0.3, "threshold": 0.5, "rule": "test",
            "validation": {}, "test": {}, "negatives": {}}
    (run / "leaf_gate.json").write_text(json.dumps(gate))
    out = tmp_path / "models"
    monkeypatch.setattr(sys, "argv", ["e", "--run", str(run), "--version", "0.0.2",
                                      "--out", str(out), "--prepared", str(prepared)])
    export.main()
    bundle = out / "mobilenetv3_large_100-0.0.2"
    meta = json.loads((bundle / "meta.json").read_text())
    assert meta["leaf_gate"]["output"] == "leaf_score" and meta["leaf_gate"]["threshold"] == 0.5

    x = np.random.default_rng(1).normal(size=(2, 3, 224, 224)).astype(np.float32)
    sess = ort.InferenceSession(str(bundle / "model.onnx"))
    logits, leaf = sess.run(["logits", "leaf_score"], {"input": x})
    with torch.no_grad():
        t = torch.from_numpy(x)
        f = m.forward_head(m.forward_features(t), pre_logits=True).numpy()
        ref_logits = m(t).numpy()
    np.testing.assert_allclose(logits, ref_logits, atol=1e-3)
    np.testing.assert_allclose(leaf, 1 / (1 + np.exp(-(f @ w + 0.3))), atol=1e-4)
