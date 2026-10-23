"""Diagnose how to retrieve folders with more than 1,000 files from Mendeley Data.

The public files endpoint returns at most 1,000 records per folder and ignores limit/offset.
This probe tries plausible paging parameters and the dataset ZIP endpoints, and logs what works.

    python -m cropguard_ml.probe_source
"""
from __future__ import annotations

import json

import requests

API = "https://data.mendeley.com/public-api/datasets/bwh3zbpkpv"
FOLDER = "a1507961-25fd-4ccc-b4ea-dbbc9cbf1aa4"  # Raw Data/CCMT Dataset/Cashew/anthracnose
S = requests.Session()
S.headers["User-Agent"] = "GhanaCropGuard-AI dataset probe (academic project)"


def files(**params):
    r = S.get(f"{API}/files", params={"folder_id": FOLDER, "version": 1, **params}, timeout=60)
    try:
        body = r.json()
    except Exception:
        return r.status_code, None, dict(r.headers)
    return r.status_code, body, dict(r.headers)


def main() -> None:
    code, base, headers = files()
    names = [f["filename"] for f in base] if isinstance(base, list) else []
    print("default:", code, len(names), names[:2], names[-2:])
    print("default headers:", {k: v for k, v in headers.items() if k.lower() in
                                ("link", "x-total-count", "x-next-page", "content-range", "x-pagination")})
    last = base[-1] if isinstance(base, list) and base else {}
    trials = {
        "sort_desc": {"sort": "filename", "order": "desc"},
        "order_desc": {"order": "desc"},
        "ordering_-filename": {"ordering": "-filename"},
        "page_2": {"page": 2},
        "page_1_size_500": {"page": 1, "page_size": 500},
        "start_1000": {"start": 1000},
        "skip_1000": {"skip": 1000},
        "from_1000": {"from": 1000},
        "marker_last_id": {"marker": last.get("id", "")},
        "after_last_id": {"after": last.get("id", "")},
        "cursor_last_id": {"cursor": last.get("id", "")},
        "filename_prefix_anthracnose9": {"filename": "anthracnose9"},
        "q_anthracnose9": {"q": "anthracnose9"},
        "search_anthracnose9": {"search": "anthracnose9"},
    }
    for name, params in trials.items():
        try:
            c, body, _ = files(**params)
            fn = [f["filename"] for f in body] if isinstance(body, list) else []
            changed = fn[:1] != names[:1] or len(fn) != len(names)
            print(f"{name:32s} {c} n={len(fn)} first={fn[:1]} last={fn[-1:]} {'<-- DIFFERENT' if changed else ''}")
        except Exception as e:
            print(f"{name:32s} error {e.__class__.__name__}")

    url = f"{API}/files"
    for name, hdr in {
        "Range items=1000-1999": {"Range": "items=1000-1999"},
        "Range items=1000-": {"Range": "items=1000-"},
        "Range items 1000-1999": {"Range": "items 1000-1999"},
        "Range items=1000-1728": {"Range": "items=1000-1728"},
        "Range items=500-999": {"Range": "items=500-999"},
        "Range-Unit+Range": {"Range-Unit": "items", "Range": "1000-1999"},
        "X-Range": {"X-Range": "items=1000-1999"},
    }.items():
        try:
            r = requests.get(url, params={"folder_id": FOLDER, "version": 1}, headers=hdr, timeout=60)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else []
            fn = [f["filename"] for f in body] if isinstance(body, list) else []
            print(f"HDR {name:26s} {r.status_code} cr={r.headers.get('Content-Range')} n={len(fn)} first={fn[:1]}")
        except Exception as e:
            print(f"HDR {name:26s} error {e}")
    for q in ({"range": "1000-1999"}, {"items": "1000-1999"}, {"offset": 1000, "limit": 1000}):
        r = requests.get(url, params={"folder_id": FOLDER, "version": 1, **q}, timeout=60)
        fn = [f["filename"] for f in r.json()] if r.ok else []
        print(f"QRY {q} {r.status_code} cr={r.headers.get('Content-Range')} first={fn[:1]}")

    for url in ["https://data.mendeley.com/public-api/zip/bwh3zbpkpv/download/1",
                "https://data.mendeley.com/public-api/zip/bwh3zbpkpv/download/1?folder_id=d0ead5a0-8f50-41f1-be66-6ba7d216c28e",
                "https://prod-dcd-datasets-cache-zipfiles.s3.eu-west-1.amazonaws.com/bwh3zbpkpv-1.zip"]:
        try:
            r = S.get(url, headers={"Range": "bytes=0-1023"}, timeout=60, allow_redirects=True, stream=True)
            h = {k: v for k, v in r.headers.items() if k.lower() in
                 ("content-type", "content-length", "content-range", "accept-ranges", "location")}
            print("ZIP", url, "->", r.status_code, r.url[:120], json.dumps(h), r.raw.read(4))
            r.close()
        except Exception as e:
            print("ZIP", url, "error", e)


if __name__ == "__main__":
    main()
