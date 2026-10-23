"""Train an image classifier on the prepared CCMT splits.

    python -m cropguard_ml.train --config configs/mobilenetv3.yaml

Model selection uses validation macro-F1 only. The test split is never read here.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import platform
import random
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import yaml
from sklearn.metrics import f1_score
from torch.utils.data import DataLoader

from .data import CCMTDataset
from .preprocess import PreprocessConfig, build_eval_transform, build_train_transform


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def create_model(arch: str, num_classes: int, pretrained: bool = True, drop_rate: float = 0.2):
    import timm

    return timm.create_model(arch, pretrained=pretrained, num_classes=num_classes, drop_rate=drop_rate)


def head_parameters(model: nn.Module):
    head = model.get_classifier()
    return list(head.parameters())


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    head_ids = {id(p) for p in head_parameters(model)}
    for p in model.parameters():
        if id(p) not in head_ids:
            p.requires_grad = trainable


@torch.no_grad()
def evaluate(model, loader, device) -> dict:
    model.eval()
    ys, ps, loss_sum, n = [], [], 0.0, 0
    ce = nn.CrossEntropyLoss(reduction="sum")
    for x, y in loader:
        x = x.to(device, memory_format=torch.channels_last)
        y = y.to(device)
        logits = model(x)
        loss_sum += ce(logits, y).item()
        n += y.numel()
        ys.append(y.cpu().numpy())
        ps.append(logits.argmax(1).cpu().numpy())
    y, p = np.concatenate(ys), np.concatenate(ps)
    return {
        "loss": loss_sum / max(n, 1),
        "acc": float((y == p).mean()),
        "macro_f1": float(f1_score(y, p, average="macro", zero_division=0)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--override", nargs="*", default=[], help="key=value overrides")
    args = ap.parse_args()
    cfg = yaml.safe_load(Path(args.config).read_text())
    for kv in args.override:
        k, v = kv.split("=", 1)
        cfg[k] = yaml.safe_load(v)

    set_seed(cfg.get("seed", 42))
    threads = int(cfg.get("threads") or os.cpu_count() or 4)
    torch.set_num_threads(threads)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    out = Path(cfg["output_dir"]) / cfg["run_name"]
    out.mkdir(parents=True, exist_ok=True)
    pcfg = PreprocessConfig(image_size=cfg.get("image_size", 224),
                            resize_size=cfg.get("resize_size", 256))

    lpc = cfg.get("limit_per_class", 0)
    train_ds = CCMTDataset(cfg["prepared_dir"], "train", build_train_transform(pcfg), lpc)
    val_ds = CCMTDataset(cfg["prepared_dir"], "val", build_eval_transform(pcfg), lpc)
    num_classes = len(train_ds.class_to_idx)
    workers = int(cfg.get("workers", min(8, os.cpu_count() or 2)))
    bs = int(cfg.get("batch_size", 32))
    train_dl = DataLoader(train_ds, bs, shuffle=True, num_workers=workers,
                          persistent_workers=workers > 0, drop_last=True)
    val_dl = DataLoader(val_ds, bs * 2, shuffle=False, num_workers=workers,
                        persistent_workers=workers > 0)

    # class weighting for imbalance: inverse sqrt frequency, normalised to mean 1
    counts = np.bincount(train_ds.targets, minlength=num_classes).astype(np.float64)
    w = 1.0 / np.sqrt(np.maximum(counts, 1))
    w = w / w.mean()
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(w, dtype=torch.float32, device=device),
                                    label_smoothing=cfg.get("label_smoothing", 0.1))

    model = create_model(cfg["arch"], num_classes, pretrained=cfg.get("pretrained", True),
                         drop_rate=cfg.get("drop_rate", 0.2)).to(device)
    model = model.to(memory_format=torch.channels_last)

    warm = int(cfg.get("head_warmup_epochs", 1))
    epochs = int(cfg.get("epochs", 10))
    lr = float(cfg.get("lr", 1e-3))
    head_lr = float(cfg.get("head_lr", lr * 5))
    wd = float(cfg.get("weight_decay", 0.05))
    patience = int(cfg.get("patience", 3))
    budget_s = float(cfg.get("time_budget_minutes", 0)) * 60 or math.inf

    history = []
    best = {"macro_f1": -1.0, "epoch": -1}
    started = time.time()
    no_improve = 0
    steps_per_epoch = len(train_dl)
    max_steps = cfg.get("max_steps_per_epoch") or steps_per_epoch

    def make_opt(phase: str):
        if phase == "head":
            set_backbone_trainable(model, False)
            params = [{"params": head_parameters(model), "lr": head_lr}]
            n_ep = warm
        else:
            set_backbone_trainable(model, True)
            head_ids = {id(p) for p in head_parameters(model)}
            params = [
                {"params": [p for p in model.parameters() if id(p) not in head_ids], "lr": lr},
                {"params": head_parameters(model), "lr": head_lr},
            ]
            n_ep = epochs - warm
        opt = torch.optim.AdamW(params, weight_decay=wd)
        total = max(1, n_ep * min(max_steps, steps_per_epoch))
        warmup_steps = min(200, total // 10)
        sched = torch.optim.lr_scheduler.LambdaLR(
            opt, lambda s: min(1.0, (s + 1) / max(1, warmup_steps))
            * 0.5 * (1 + math.cos(math.pi * min(1.0, s / total))))
        return opt, sched

    phase = "head" if warm > 0 else "full"
    opt, sched = make_opt(phase)
    print(f"[{cfg['run_name']}] arch={cfg['arch']} classes={num_classes} train={len(train_ds)} "
          f"val={len(val_ds)} threads={threads} device={device}", flush=True)

    for epoch in range(epochs):
        if epoch == warm and phase == "head":
            phase = "full"
            opt, sched = make_opt(phase)
        model.train()
        t0, seen, loss_sum, correct = time.time(), 0, 0.0, 0
        for step, (x, y) in enumerate(train_dl):
            if step >= max_steps:
                break
            x = x.to(device, memory_format=torch.channels_last)
            y = y.to(device)
            logits = model(x)
            loss = criterion(logits, y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
            sched.step()
            seen += y.numel()
            loss_sum += loss.item() * y.numel()
            correct += (logits.argmax(1) == y).sum().item()
            if step % 50 == 0:
                rate = seen / max(time.time() - t0, 1e-6)
                print(f"  ep{epoch} {phase} step {step}/{min(max_steps, steps_per_epoch)} "
                      f"loss {loss.item():.3f} {rate:.1f} img/s", flush=True)
            if time.time() - started > budget_s:
                break
        train_time = time.time() - t0
        val = evaluate(model, val_dl, device)
        rec = {"epoch": epoch, "phase": phase, "train_loss": loss_sum / max(seen, 1),
               "train_acc": correct / max(seen, 1), "val_loss": val["loss"], "val_acc": val["acc"],
               "val_macro_f1": val["macro_f1"], "epoch_seconds": round(train_time, 1),
               "lr": opt.param_groups[0]["lr"]}
        history.append(rec)
        print(json.dumps(rec), flush=True)
        if val["macro_f1"] > best["macro_f1"]:
            best = {"macro_f1": val["macro_f1"], "acc": val["acc"], "epoch": epoch}
            torch.save({"state_dict": model.state_dict(), "arch": cfg["arch"],
                        "num_classes": num_classes, "class_to_idx": train_ds.class_to_idx,
                        "preprocess": pcfg.to_dict(), "config": cfg, "best": best},
                       out / "best.pt")
            no_improve = 0
        else:
            no_improve += 1
        (out / "history.json").write_text(json.dumps(history, indent=2))
        if phase == "full" and no_improve >= patience:
            print("Early stopping.")
            break
        if time.time() - started > budget_s:
            print("Time budget reached.")
            break

    summary = {
        "run_name": cfg["run_name"], "arch": cfg["arch"], "best": best,
        "epochs_run": len(history), "train_minutes": round((time.time() - started) / 60, 1),
        "train_images": len(train_ds), "val_images": len(val_ds),
        "device": str(device), "threads": threads, "torch": torch.__version__,
        "platform": platform.platform(), "config": cfg,
    }
    (out / "train_summary.json").write_text(json.dumps(summary, indent=2))
    _plot_curves(history, out / "learning_curves.png", cfg["run_name"])
    print(json.dumps(summary["best"]))


def _plot_curves(history, path, title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if not history:
        return
    ep = [h["epoch"] + 1 for h in history]
    fig, (a, b) = plt.subplots(1, 2, figsize=(11, 4))
    a.plot(ep, [h["train_loss"] for h in history], label="train", color="#2f6b3a")
    a.plot(ep, [h["val_loss"] for h in history], label="validation", color="#8a3b12")
    a.set_title("Loss")
    a.set_xlabel("epoch")
    a.legend(frameon=False)
    b.plot(ep, [h["train_acc"] for h in history], label="train acc", color="#2f6b3a")
    b.plot(ep, [h["val_acc"] for h in history], label="val acc", color="#8a3b12")
    b.plot(ep, [h["val_macro_f1"] for h in history], label="val macro-F1", color="#c9a227")
    b.set_title("Accuracy / macro-F1")
    b.set_xlabel("epoch")
    b.legend(frameon=False)
    for ax in (a, b):
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
