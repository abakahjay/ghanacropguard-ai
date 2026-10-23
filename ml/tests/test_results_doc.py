import json

from cropguard_ml import results_doc


def test_results_doc_without_runs_reports_missing(tmp_path):
    ml = tmp_path / "ml"
    (ml / "data/raw").mkdir(parents=True)
    (ml / "data/raw/manifest.json").write_text(json.dumps([{"relpath": "a"}] * 3))
    text = results_doc.build(ml, tmp_path)
    assert "**3**" in text
    assert "not trained/evaluated yet" in text
    assert "No model has been exported" in text
