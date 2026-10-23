# Content policy for crop guidance

Text shown with predictions lives in FullBackendd `data/cropguard/content.json` (`guidance`, `sources`, `alwaysSteps`, `escalate`). Its test `test/cropguard/unit.test.js` enforces the rules below (every class covered, no dosage wording, only the listed sources).

- Describe visible signs and widely recommended cultural / field-hygiene practices only.
- **No pesticide product names, doses, mixing ratios or guaranteed cures.** Chemical decisions are referred to a district MoFA extension officer. A test (`test_knowledge_covers_all_classes_without_dosages`) fails on dosage-like wording.
- Cite organisations the reader can check (CABI PlantwisePlus, IITA, FAO, MoFA, PlantVillage). Do not invent references.
- Plain, short English. Every result ends with the escalation line and the scope/disclaimer.
- Translations (Twi, Ewe, Dagbani, …) go in a parallel dictionary keyed by language code and must be reviewed by a fluent speaker with agricultural knowledge before being enabled in `SUPPORTED_LANGUAGES`.
