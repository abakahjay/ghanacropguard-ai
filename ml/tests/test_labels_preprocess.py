import io

import numpy as np
import pytest
from PIL import Image

from cropguard_ml import labels
from cropguard_ml.preprocess import (
    InvalidImageError,
    PreprocessConfig,
    build_eval_transform,
    load_image,
    preprocess_eval,
)


def _jpeg(w=640, h=480, color=(30, 140, 60), exif_orientation=None) -> bytes:
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    if exif_orientation:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation
        img.save(buf, "JPEG", exif=exif.tobytes())
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def test_registry_has_22_classes_over_4_crops():
    assert len(labels.CLASSES) == 22
    per_crop = {c: sum(1 for ci in labels.CLASSES.values() if ci.crop == c) for c in labels.CROPS}
    assert per_crop == {"cashew": 5, "cassava": 5, "maize": 7, "tomato": 5}


@pytest.mark.parametrize("crop,folder,key,display", [
    ("Cashew", "gumosis", "cashew_gummosis", "Gummosis"),
    ("Maize", "grasshoper", "maize_grasshopper", "Grasshopper"),
    ("Tomato", "verticulium wilt", "tomato_verticillium_wilt", "Verticillium wilt"),
    ("Cassava", "healthy", "cassava_healthy", "Healthy"),
])
def test_source_folder_spelling_is_mapped(crop, folder, key, display):
    ci = labels.from_source(crop, folder)
    assert ci.key == key and ci.display_name == display


def test_unknown_folder_rejected():
    with pytest.raises(KeyError):
        labels.from_source("Cocoa", "black pod")


def test_class_to_index_is_sorted_and_contiguous():
    keys = list(labels.CLASSES)[::-1]
    m = labels.class_to_index(keys)
    assert list(m) == sorted(keys)
    assert sorted(m.values()) == list(range(22))


def test_preprocess_shape_and_normalisation():
    cfg = PreprocessConfig()
    arr = preprocess_eval(load_image(_jpeg(1080, 487)), cfg)
    assert arr.shape == (3, 224, 224) and arr.dtype == np.float32
    # a flat colour normalises to ((c/255)-mean)/std per channel (JPEG tolerance)
    expected = (np.array([30, 140, 60]) / 255 - np.array(cfg.mean)) / np.array(cfg.std)
    assert np.allclose(arr.mean(axis=(1, 2)), expected, atol=0.05)


def test_exif_orientation_applied():
    img = load_image(_jpeg(400, 200, exif_orientation=6))  # rotate 90
    assert img.size == (200, 400)


def test_torch_eval_transform_matches_numpy():
    torch = pytest.importorskip("torch")
    cfg = PreprocessConfig()
    img = load_image(_jpeg(800, 600))
    t = build_eval_transform(cfg)(img)
    assert isinstance(t, torch.Tensor)
    assert np.array_equal(t.numpy(), preprocess_eval(img, cfg))


@pytest.mark.parametrize("data", [b"", b"not an image", _jpeg()[:200]])
def test_invalid_images_raise(data):
    with pytest.raises(InvalidImageError):
        load_image(data)


def test_preprocess_config_roundtrip():
    cfg = PreprocessConfig(image_size=192, resize_size=220)
    assert PreprocessConfig.from_dict(cfg.to_dict()) == cfg
