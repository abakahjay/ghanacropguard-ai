"""Image preprocessing shared by training, evaluation and ONNX export checks.

The API (FullBackendd, Node.js) serves the model with a line-for-line port of
`load_image` + `preprocess_eval` in its `utils/cropguardPreprocess.js` (PIL's
bicubic resize included), checked to give bit-identical tensors. Change both
together. The parameters (image size, resize size, mean, std) are stored in the
model bundle's meta.json and read back at inference time.
"""
from __future__ import annotations

import io
from dataclasses import asdict, dataclass

from PIL import Image, ImageOps

# Guard against decompression bombs from untrusted uploads (~ 50 MP).
Image.MAX_IMAGE_PIXELS = 50_000_000

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


@dataclass(frozen=True)
class PreprocessConfig:
    image_size: int = 224
    resize_size: int = 256  # shorter side before centre crop
    mean: tuple[float, float, float] = IMAGENET_MEAN
    std: tuple[float, float, float] = IMAGENET_STD
    interpolation: str = "bicubic"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["mean"], d["std"] = list(self.mean), list(self.std)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> PreprocessConfig:
        return cls(
            image_size=int(d["image_size"]),
            resize_size=int(d["resize_size"]),
            mean=tuple(d["mean"]),
            std=tuple(d["std"]),
            interpolation=d.get("interpolation", "bicubic"),
        )


class InvalidImageError(ValueError):
    pass


def load_image(data: bytes | str, max_pixels: int = 50_000_000) -> Image.Image:
    """Decode bytes or a path into an RGB PIL image with EXIF orientation applied.

    Raises InvalidImageError for anything that is not a decodable image.
    """
    try:
        src = io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data
        with Image.open(src) as probe:
            probe.verify()  # structural check, consumes the file object
        src = io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data
        img = Image.open(src)
        if img.width * img.height > max_pixels:
            raise InvalidImageError("Image has too many pixels")
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except InvalidImageError:
        raise
    except Exception as exc:  # PIL raises many types
        raise InvalidImageError(f"Not a valid image: {exc.__class__.__name__}") from exc


def resize_short_side(img: Image.Image, size: int) -> Image.Image:
    w, h = img.size
    if min(w, h) == size:
        return img
    scale = size / min(w, h)
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BICUBIC)


def center_crop(img: Image.Image, size: int) -> Image.Image:
    w, h = img.size
    left = int(round((w - size) / 2.0))
    top = int(round((h - size) / 2.0))
    return img.crop((left, top, left + size, top + size))


def preprocess_eval(img: Image.Image, cfg: PreprocessConfig):
    """PIL RGB image -> float32 CHW numpy array. Pure NumPy/PIL (no torch).

    This single function is used for validation, testing and ONNX export checks;
    the API's JS port must match it exactly.
    """
    import numpy as np

    img = center_crop(resize_short_side(img, cfg.resize_size), cfg.image_size)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - np.asarray(cfg.mean, dtype=np.float32)) / np.asarray(cfg.std, dtype=np.float32)
    return np.ascontiguousarray(arr.transpose(2, 0, 1))


class EvalTransform:
    """Picklable torch wrapper around preprocess_eval (safe for DataLoader workers)."""

    def __init__(self, cfg: PreprocessConfig):
        self.cfg = cfg

    def __call__(self, img):
        import torch

        return torch.from_numpy(preprocess_eval(img, self.cfg))


def build_eval_transform(cfg: PreprocessConfig) -> EvalTransform:
    return EvalTransform(cfg)


def build_train_transform(cfg: PreprocessConfig):
    """Training-only augmentation. Never applied to validation/test/inference."""
    from torchvision import transforms as T

    return T.Compose([
        T.RandomResizedCrop(cfg.image_size, scale=(0.5, 1.0),
                            interpolation=T.InterpolationMode.BICUBIC),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        T.RandomApply([T.RandomRotation(20)], p=0.3),
        T.ColorJitter(0.25, 0.25, 0.2, 0.02),
        T.ToTensor(),
        T.Normalize(cfg.mean, cfg.std),
        T.RandomErasing(p=0.15, scale=(0.02, 0.12)),
    ])
