"""Measure CPU training throughput per architecture before committing to a long run.

    python -m cropguard_ml.benchmark --archs mobilenetv3_large_100 efficientnet_b0 convnext_tiny
"""
from __future__ import annotations

import argparse
import json
import time

import torch
import torch.nn as nn

from .train import create_model


def bench(arch: str, bs: int, size: int, steps: int) -> dict:
    m = create_model(arch, 22, pretrained=False).to(memory_format=torch.channels_last)
    opt = torch.optim.AdamW(m.parameters(), 1e-4)
    x = torch.randn(bs, 3, size, size).to(memory_format=torch.channels_last)
    y = torch.randint(0, 22, (bs,))
    ce = nn.CrossEntropyLoss()
    m.train()
    for _ in range(2):
        opt.zero_grad()
        ce(m(x), y).backward()
        opt.step()
    t = time.perf_counter()
    for _ in range(steps):
        opt.zero_grad()
        ce(m(x), y).backward()
        opt.step()
    train_ips = bs * steps / (time.perf_counter() - t)
    m.eval()
    with torch.no_grad():
        t = time.perf_counter()
        for _ in range(steps):
            m(x)
        infer_ips = bs * steps / (time.perf_counter() - t)
    params = sum(p.numel() for p in m.parameters()) / 1e6
    return {"arch": arch, "params_m": round(params, 2), "train_img_s": round(train_ips, 1),
            "infer_img_s": round(infer_ips, 1)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archs", nargs="+", default=["mobilenetv3_large_100", "efficientnet_b0",
                                                   "convnext_tiny"])
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--steps", type=int, default=5)
    ap.add_argument("--train-images", type=int, default=17000)
    a = ap.parse_args()
    print(f"threads={torch.get_num_threads()}")
    for arch in a.archs:
        r = bench(arch, a.bs, a.size, a.steps)
        r["est_min_per_epoch"] = round(a.train_images / r["train_img_s"] / 60, 1)
        print(json.dumps(r), flush=True)


if __name__ == "__main__":
    main()
