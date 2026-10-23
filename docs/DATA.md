# Data

**Source:** CCMT — Dataset for Crop Pest and Disease Detection, Mendeley Data, version 1, https://doi.org/10.17632/bwh3zbpkpv.1 — licence **CC BY 4.0** (attribution required; commercial use allowed). Article: Mensah et al., *Data in Brief* 49 (2023) 109306, https://doi.org/10.1016/j.dib.2023.109306.

**Subset used:** `Raw Data/CCMT Dataset` only — 22 class folders, 24,881 images as published (Cashew 6,549; Cassava 7,508; Maize 5,389; Tomato 5,435). The `CCMT Dataset-Augmented` tree is **not** used: it contains augmented copies of the same originals, and splitting it would leak near-identical images between training and test.

**Label mapping:** source folder names are kept as provenance; three are misspelled in the source and mapped to correct display names (`gumosis`→Gummosis, `grasshoper`→Grasshopper, `verticulium wilt`→Verticillium wilt). Canonical keys are `<crop>_<condition>` (e.g. `cassava_mosaic`); the class-to-index map is the sorted list of keys (`data/prepared/class_to_idx.json`, also embedded in every model bundle).

**Download** (`cropguard_ml.download`, `cropguard_ml.download_zip`):
- The Mendeley files API lists at most 1,000 files per folder (it reports the true total in `Content-Range` but ignores paging parameters). Files it lists are downloaded and verified against the published SHA-256.
- The remaining files are read from the dataset ZIP over HTTP range requests: only `Raw Data/…` entries are fetched, each verified by its ZIP CRC-32, and its SHA-256 recorded.
- `data/raw/manifest.json` and `PROVENANCE.json` record every file, hash, source and the per-class counts.

**Cleaning and splitting** (`cropguard_ml.prepare`):
1. Decode every image with EXIF orientation; undecodable files are excluded and listed.
2. Exact duplicates (same SHA-256): kept once within a class; if the same image appears in two classes, **all** copies are excluded as label conflicts.
3. Near duplicates: 64-bit difference hash; images in the same class within 4 bits are grouped (union-find). Cross-class near duplicates are reported.
4. Group-aware stratified split 70/15/15 (seed 42). A group never spans splits; the script asserts this and that no hash appears in two splits.
5. A resized cache (shorter side 288 px) speeds up CPU training; it is made with the same resize function used at inference.
Outputs: `splits.csv`, `class_to_idx.json`, `classes.json`, `dataset_report.json`, `class_distribution.png`.

**Imbalance:** class-weighted cross-entropy (inverse square-root frequency) plus training-only augmentation; macro-F1 is the selection metric.

**Limitations of the data:** one region of collection, one camera type; classes can share backgrounds; "healthy" means none of the 22 listed conditions, not a clean bill of health. No independent field set from other phones/regions has been evaluated (see report).
