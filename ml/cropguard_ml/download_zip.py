"""Complete the raw CCMT download from the dataset ZIP using HTTP range requests.

Why: the Mendeley files API lists at most 1,000 files per folder, but 13 raw class folders hold
more. The "Download All" ZIP (served from S3 with range support) contains every file. Rather than
downloading the whole archive (which also holds ~100k augmented images), this reads the ZIP's
central directory over HTTP and fetches only the missing "Raw Data/CCMT Dataset/..." entries.
Each entry is verified with its ZIP CRC-32; its SHA-256 is computed and added to the manifest.

    python -m cropguard_ml.download_zip --raw data/raw
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import io
import json
import struct
import threading
import time
import zipfile
import zlib
from pathlib import Path

import requests

ZIP_ENTRY = "https://data.mendeley.com/public-api/zip/bwh3zbpkpv/download/1"
RAW_MARK = "Raw Data/CCMT Dataset/"


class RangeFile(io.RawIOBase):
    """Seekable read-only file over HTTP range requests, with a small block cache.

    The signed S3 URL behind the Mendeley redirect expires; it is re-resolved on 403.
    """

    BLOCK = 1 << 18  # 256 KB

    def __init__(self, entry_url: str):
        self.entry_url = entry_url
        self.s = requests.Session()
        self.s.headers["User-Agent"] = "GhanaCropGuard-AI dataset fetcher (academic project)"
        self.lock = threading.Lock()
        self._resolve()
        self.pos = 0
        self.cache: dict[int, bytes] = {}

    def _resolve(self) -> None:
        r = self.s.get(self.entry_url, headers={"Range": "bytes=0-0"}, allow_redirects=True, timeout=60)
        r.raise_for_status()
        self.url = r.url
        self.size = int(r.headers["Content-Range"].rsplit("/", 1)[1])

    def fetch(self, start: int, end: int) -> bytes:
        """Inclusive byte range."""
        for attempt in range(6):
            try:
                r = self.s.get(self.url, headers={"Range": f"bytes={start}-{end}"}, timeout=120)
                if r.status_code == 403:
                    with self.lock:
                        self._resolve()
                    continue
                r.raise_for_status()
                if len(r.content) != end - start + 1:
                    raise OSError("short read")
                return r.content
            except Exception:
                if attempt == 5:
                    raise
                time.sleep(2 ** attempt)
        raise OSError("unreachable")

    # io.RawIOBase interface (used by zipfile to read the central directory)
    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = {0: offset, 1: self.pos + offset, 2: self.size + offset}[whence]
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            n = self.size - self.pos
        n = max(0, min(n, self.size - self.pos))
        out = bytearray()
        while n > 0:
            b = self.pos // self.BLOCK
            if b not in self.cache:
                if len(self.cache) > 256:
                    self.cache.clear()
                s = b * self.BLOCK
                self.cache[b] = self.fetch(s, min(self.size, s + self.BLOCK) - 1)
            blk = self.cache[b]
            off = self.pos - b * self.BLOCK
            chunk = blk[off: off + n]
            out += chunk
            self.pos += len(chunk)
            n -= len(chunk)
        return bytes(out)


def extract_member(rf: RangeFile, info: zipfile.ZipInfo) -> bytes:
    """Fetch one member with a single range request (local header + data) and verify CRC."""
    guess = 30 + len(info.filename.encode()) + 256
    raw = rf.fetch(info.header_offset, min(rf.size - 1, info.header_offset + guess + info.compress_size - 1))
    sig, *_rest = struct.unpack("<IHHHHHIIIHH", raw[:30])
    if sig != 0x04034B50:
        raise OSError("bad local header")
    name_len, extra_len = struct.unpack("<HH", raw[26:30])
    start = 30 + name_len + extra_len
    data = raw[start: start + info.compress_size]
    if len(data) < info.compress_size:  # extra field longer than guessed
        data = rf.fetch(info.header_offset + start, info.header_offset + start + info.compress_size - 1)
    if info.compress_type == zipfile.ZIP_STORED:
        out = data
    elif info.compress_type == zipfile.ZIP_DEFLATED:
        out = zlib.decompress(data, -15)
    else:
        raise OSError(f"unsupported compression {info.compress_type}")
    if zlib.crc32(out) & 0xFFFFFFFF != info.CRC:
        raise OSError("CRC mismatch")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--zip-url", default=ZIP_ENTRY)
    args = ap.parse_args()
    raw = Path(args.raw)

    rf = RangeFile(args.zip_url)
    print(f"ZIP size: {rf.size / 1e9:.2f} GB; reading central directory…", flush=True)
    t0 = time.time()
    zf = zipfile.ZipFile(rf)
    infos = [i for i in zf.infolist() if RAW_MARK in i.filename and not i.is_dir()]
    print(f"Central directory read in {time.time() - t0:.0f}s: {len(zf.infolist())} entries, "
          f"{len(infos)} raw images", flush=True)

    manifest_p = raw / "manifest.json"
    manifest = json.loads(manifest_p.read_text()) if manifest_p.exists() else []
    per_class: dict[str, int] = {}
    todo = []
    for i in infos:
        rel_parts = i.filename.split(RAW_MARK, 1)[1].split("/")
        if len(rel_parts) != 3:
            continue
        crop, cls, fname = rel_parts
        per_class[f"{crop}/{cls}"] = per_class.get(f"{crop}/{cls}", 0) + 1
        rel = f"{crop}/{cls}/{fname}"
        if (raw / rel).exists():  # already fetched (by the files API or an earlier run)
            continue
        todo.append((i, rel, crop, cls, fname))
    print(f"Raw images per class in ZIP: {json.dumps(per_class)}")
    print(f"Already present: {len(infos) - len(todo)}; to fetch: {len(todo)}", flush=True)

    lock = threading.Lock()
    done = failed = 0
    new_entries = []

    def work(item):
        info, rel, crop, cls, fname = item
        dest = raw / rel
        data = extract_member(rf, info)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".zpart")  # distinct from the API downloader's .part
        tmp.write_bytes(data)
        tmp.replace(dest)
        return {"crop_folder": crop, "class_folder": cls, "filename": fname, "file_id": None,
                "sha256": hashlib.sha256(data).hexdigest(), "size": len(data), "relpath": rel,
                "source": "zip", "zip_crc32": f"{info.CRC:08x}"}

    with cf.ThreadPoolExecutor(args.workers) as ex:
        futs = {ex.submit(work, t): t for t in todo}
        for fut in cf.as_completed(futs):
            try:
                e = fut.result()
                with lock:
                    new_entries.append(e)
                    done += 1
            except Exception as exc:
                failed += 1
                print(f"  failed {futs[fut][1]}: {exc}")
            if (done + failed) % 250 == 0:
                print(f"  {done + failed}/{len(todo)} fetched (failed {failed})", flush=True)

    by_rel = {m["relpath"]: m for m in manifest}
    for e in new_entries:
        by_rel[e["relpath"]] = e
    manifest = sorted(by_rel.values(), key=lambda m: m["relpath"])
    manifest_p.write_text(json.dumps(manifest, indent=1))
    prov_p = raw / "PROVENANCE.json"
    prov = json.loads(prov_p.read_text()) if prov_p.exists() else {}
    prov.update({"file_count": len(manifest), "zip_completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 "zip_raw_counts": per_class, "zip_raw_total": len(infos),
                 "method": "files API (sha256-verified) + dataset ZIP via HTTP range (CRC32-verified)"})
    prov_p.write_text(json.dumps(prov, indent=2))
    print(json.dumps({"fetched": done, "failed": failed, "manifest_files": len(manifest),
                      "zip_raw_total": len(infos)}, indent=2))


if __name__ == "__main__":
    main()
