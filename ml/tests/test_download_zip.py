"""The ZIP range extractor, tested against a real in-memory ZIP served through a fake ranged file."""
import io
import json
import sys
import zipfile

from cropguard_ml import download_zip as dz


class FakeRange(dz.RangeFile):
    def __init__(self, blob: bytes):  # noqa: D107 - bypass network
        self.blob, self.size, self.pos, self.cache = blob, len(blob), 0, {}
        import threading
        self.lock = threading.Lock()

    def fetch(self, start, end):
        return self.blob[start:end + 1]


def _zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("Raw Data/CCMT Dataset/Cashew/gumosis/a.jpg", b"\xff\xd8 stored " * 50, zipfile.ZIP_STORED)
        z.writestr("Raw Data/CCMT Dataset/Cashew/gumosis/b.jpg", b"\xff\xd8 deflated " * 500, zipfile.ZIP_DEFLATED)
        z.writestr("CCMT Dataset-Augmented/Cashew/train_set/gumosis/c.jpg", b"augmented", zipfile.ZIP_STORED)
    return buf.getvalue()


def test_extract_member_stored_and_deflated():
    blob = _zip()
    rf = FakeRange(blob)
    zf = zipfile.ZipFile(rf)
    got = {i.filename: dz.extract_member(rf, i) for i in zf.infolist()}
    assert got["Raw Data/CCMT Dataset/Cashew/gumosis/a.jpg"] == b"\xff\xd8 stored " * 50
    assert got["Raw Data/CCMT Dataset/Cashew/gumosis/b.jpg"] == b"\xff\xd8 deflated " * 500


def test_main_fetches_only_missing_raw(tmp_path, monkeypatch):
    blob = _zip()
    monkeypatch.setattr(dz, "RangeFile", lambda url: FakeRange(blob))
    raw = tmp_path / "raw"
    (raw / "Cashew/gumosis").mkdir(parents=True)
    (raw / "Cashew/gumosis/a.jpg").write_bytes(b"\xff\xd8 stored " * 50)
    (raw / "manifest.json").write_text(json.dumps([{"relpath": "Cashew/gumosis/a.jpg", "sha256": "x"}]))
    monkeypatch.setattr(sys, "argv", ["dz", "--raw", str(raw), "--workers", "2"])
    dz.main()
    m = json.loads((raw / "manifest.json").read_text())
    assert [e["relpath"] for e in m] == ["Cashew/gumosis/a.jpg", "Cashew/gumosis/b.jpg"]
    assert (raw / "Cashew/gumosis/b.jpg").read_bytes() == b"\xff\xd8 deflated " * 500
    assert not (raw / "CCMT Dataset-Augmented").exists()
    prov = json.loads((raw / "PROVENANCE.json").read_text())
    assert prov["zip_raw_total"] == 2
