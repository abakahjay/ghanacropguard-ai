"""Download the *raw* CCMT images from Mendeley Data (CC BY 4.0).

Only the "Raw Data/CCMT Dataset" tree is fetched. The augmented tree is
skipped on purpose: its train/test folders contain augmented copies derived
from the same originals, so splitting it would leak near-identical images
between training and evaluation.

Every file is verified against the SHA-256 published by Mendeley. Re-running
resumes: files already present with a matching hash are skipped.

    python -m cropguard_ml.download --out data/raw
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import time
from pathlib import Path

import requests

API = "https://data.mendeley.com/public-api/datasets"
DATASET_ID = "bwh3zbpkpv"
VERSION = 1
ROOT_FOLDER_NAME = "Raw Data"
LICENSE = "CC BY 4.0"
CITATION = (
    "Mensah, P. K., Akoto-Adjepong, V., Adu, K., Ayidzoe, M. A., Bediako, E. A., "
    "Nyarko-Boateng, O., Boateng, S., Donkor, E. F., Umar Bawah, F., Awarayi, N. S., "
    "Nimbe, P., Nti, I. K., Abdulai, M., Adjei, R. R., Opoku, M., Abdulai, S., & Amu-Mensah, F. "
    "(2023). CCMT: Dataset for crop pest and disease detection. Data in Brief, 49, 109306. "
    "https://doi.org/10.1016/j.dib.2023.109306 ; data: https://doi.org/10.17632/bwh3zbpkpv.1"
)

session = requests.Session()
session.headers["User-Agent"] = "GhanaCropGuard-AI dataset fetcher (academic project)"


def _get_json(url: str, params: dict | None = None, retries: int = 5):
    for attempt in range(retries):
        try:
            r = session.get(url, params=params, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def list_folders() -> list[dict]:
    return _get_json(f"{API}/{DATASET_ID}/folders/{VERSION}")


def list_files(folder_id: str) -> tuple[list[dict], int | None]:
    """List every file in a folder.

    The endpoint returns at most 1,000 records and ignores limit/offset query parameters.
    It pages with HTTP range headers instead: the reply is 206 with
    `Content-Range: items 0-999/<total>`, and the next page is requested with
    `Range: items=1000-1999` (found with cropguard_ml.probe_source on 2026-10-22).
    """
    url = f"{API}/{DATASET_ID}/files"
    params = {"folder_id": folder_id, "version": VERSION}
    out: dict[str, dict] = {}
    start, page = 0, 1000
    total = None
    while True:
        for attempt in range(5):
            try:
                r = session.get(url, params=params, headers={"Range": f"items={start}-{start + page - 1}"},
                                timeout=60)
                r.raise_for_status()
                batch = r.json()
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
        cr = r.headers.get("Content-Range", "")
        if "/" in cr:
            try:
                total = int(cr.rsplit("/", 1)[1])
            except ValueError:
                total = None
        before = len(out)
        for f in batch:
            out[f["id"]] = f
        start += page
        if not batch or len(out) == before or total is None or len(out) >= total:
            break
    if total is not None and len(out) != total:
        print(f"  WARNING folder {folder_id}: listed {len(out)} of {total} files")
    return list(out.values()), total


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(rec: dict, dest: Path) -> tuple[str, str]:
    expected = rec["content_details"]["sha256_hash"]
    if dest.exists() and sha256(dest) == expected:
        return "skipped", str(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(5):
        try:
            with session.get(rec["content_details"]["download_url"], stream=True, timeout=120) as r:
                r.raise_for_status()
                with open(tmp, "wb") as fh:
                    for chunk in r.iter_content(1 << 16):
                        fh.write(chunk)
            if sha256(tmp) != expected:
                raise OSError("sha256 mismatch")
            tmp.replace(dest)
            return "downloaded", str(dest)
        except Exception as exc:  # retry with backoff
            if attempt == 4:
                tmp.unlink(missing_ok=True)
                return f"failed: {exc}", str(dest)
            time.sleep(2 ** attempt)
    return "failed", str(dest)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--limit-per-class", type=int, default=0, help="debug: cap files per class")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    folders = list_folders()
    by_id = {f["id"]: f for f in folders}
    children: dict[str | None, list[dict]] = {}
    for f in folders:
        children.setdefault(f.get("parent_id"), []).append(f)

    root = next(f for f in folders if f["name"] == ROOT_FOLDER_NAME and not f.get("parent_id"))

    def path_of(fid: str) -> list[str]:
        parts = []
        while fid and fid != root["id"]:
            parts.append(by_id[fid]["name"])
            fid = by_id[fid].get("parent_id")
        return parts[::-1]

    # leaf folders under Raw Data: <CCMT Dataset>/<Crop>/<class>
    leaves = []
    stack = [root]
    while stack:
        node = stack.pop()
        kids = children.get(node["id"], [])
        if not kids and node is not root:
            leaves.append(node)
        stack.extend(kids)

    jobs, manifest = [], []
    expected: dict[str, int] = {}
    for leaf in sorted(leaves, key=lambda f: path_of(f["id"])):
        parts = path_of(leaf["id"])  # e.g. ["CCMT Dataset", "Cashew", "gumosis"]
        crop, cls = parts[-2], parts[-1]
        files, total = list_files(leaf["id"])
        expected[f"{crop}/{cls}"] = total if total is not None else len(files)
        if args.limit_per_class:
            files = files[: args.limit_per_class]
        print(f"{crop}/{cls}: {len(files)} files listed (folder total {total})")
        for rec in files:
            dest = out / crop / cls / rec["filename"]
            jobs.append((rec, dest))
            manifest.append({
                "crop_folder": crop, "class_folder": cls, "filename": rec["filename"],
                "file_id": rec["id"], "sha256": rec["content_details"]["sha256_hash"],
                "size": rec["size"], "relpath": str(dest.relative_to(out)).replace("\\", "/"),
            })

    print(f"Total files listed: {len(jobs)}")
    stats: dict[str, int] = {}
    failures = []
    with cf.ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(_download, r, d) for r, d in jobs]
        for i, fut in enumerate(cf.as_completed(futs), 1):
            status, p = fut.result()
            key = status.split(":")[0]
            stats[key] = stats.get(key, 0) + 1
            if key == "failed":
                failures.append({"path": p, "error": status})
            if i % 500 == 0:
                print(f"  {i}/{len(jobs)} {stats}", flush=True)

    # merge with any entries written by download_zip (which may run concurrently or earlier)
    mp = out / "manifest.json"
    if mp.exists():
        prev = {m["relpath"]: m for m in json.loads(mp.read_text())}
        prev.update({m["relpath"]: m for m in manifest})
        manifest = sorted(prev.values(), key=lambda m: m["relpath"])
    mp.write_text(json.dumps(manifest, indent=1))

    pp = out / "PROVENANCE.json"
    meta = json.loads(pp.read_text()) if pp.exists() else {}
    meta.update({
        "dataset": "CCMT: Dataset for Crop Pest and Disease Detection",
        "source": f"https://data.mendeley.com/datasets/{DATASET_ID}/{VERSION}",
        "doi": "10.17632/bwh3zbpkpv.1",
        "license": LICENSE,
        "citation": CITATION,
        "subset": "Raw Data/CCMT Dataset (augmented tree intentionally excluded)",
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "file_count": len(manifest),
        "expected_counts": expected,
        "expected_total": sum(expected.values()),
        "api_stats": stats,
        "failures": failures,
    })
    pp.write_text(json.dumps(meta, indent=2))
    print(json.dumps({k: v for k, v in meta.items() if k not in ("failures", "expected_counts", "zip_raw_counts")},
                     indent=2))
    if failures:
        print(f"WARNING: {len(failures)} files failed; re-run to resume.")
    missing = sum(expected.values()) - len(manifest)
    if missing > 0:
        print(f"NOTE: {missing} files are not reachable through the files API listing (1,000-record cap). "
              "Run `python -m cropguard_ml.download_zip` (task 'ML 3c') to fetch them from the dataset ZIP.")

if __name__ == "__main__":
    main()
