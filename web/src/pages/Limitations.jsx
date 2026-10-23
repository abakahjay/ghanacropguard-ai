import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { useModelInfo } from "@/lib/content";
import { intOr, numOr, pctOr } from "@/lib/format";
import { useTitle } from "@/lib/useTitle";

const LIMITS = [
  [
    "It is not a diagnosis.",
    "The model compares your photo with photos it has seen. It can be wrong, and it cannot examine roots, stems inside, soil or the whole field. Use the result as a first hint and confirm with an extension officer.",
  ],
  [
    "It only knows 22 conditions of 4 crops.",
    "Anything else (another crop, another disease, nutrient deficiency, drought stress) will still be matched to one of the 22, so the answer is meaningless for those photos.",
  ],
  [
    "Photos unlike the training photos are harder.",
    "The training photos were taken on Ghanaian farms with a high-resolution camera. Blurred, dark, very distant or heavily shaded photos may give poor results.",
  ],
  ["One photo, one condition.", "A plant with two problems at once will usually get only the more visible one."],
  [
    "Confidence is not certainty.",
    "A high percentage means the photo looks very like the training photos of that class. It is not the probability that your plant truly has it. Results under 60% are flagged.",
  ],
  [
    "No treatment doses.",
    "The app never gives pesticide names or doses. Your extension officer can advise on approved products and safe use.",
  ],
  [
    "Offline use.",
    "The current app needs an internet connection to analyse a photo. On-device analysis is planned and will be announced only once it has been tested.",
  ],
];

export function LimitationsPage() {
  useTitle("Limits and accuracy");
  const { data: info } = useModelInfo();
  const t = info?.test_metrics;
  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <h1 className="max-w-[16ch] text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">
          Limits and accuracy
        </h1>
        <p className="mt-5 max-w-[60ch] text-[length:var(--step-lead)] font-light text-ink-2">
          What the model was tested on, how well it did, and where it should not be trusted.
        </p>

        <section
          aria-labelledby="acc-h"
          className="mt-14 grid gap-6 rounded-[var(--radius-lg)] bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12"
        >
          <div>
            <h2 id="acc-h" className="text-[20px] font-medium">
              Measured accuracy
            </h2>
            <p className="mt-2 max-w-[42ch] text-[15px] text-muted">
              Results on a held-out test split of the CCMT dataset that was never used for training or model selection.
              They describe that data, not every farm or phone.
            </p>
          </div>
          {t ? (
            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {[
                  ["Accuracy", pctOr(t.accuracy)],
                  ["Correct in top 3", pctOr(t.top3_accuracy)],
                  ["Macro F1", numOr(t.f1_macro)],
                  ["Macro precision", numOr(t.precision_macro)],
                  ["Macro recall", numOr(t.recall_macro)],
                  ["Test photos", intOr(t.n_images)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[14px] text-muted">{k}</dt>
                    <dd className="tabular mt-1 text-[clamp(26px,2.6vw,36px)] font-light">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[14px] text-muted">
                Model {info.name} ({info.arch}). {info.note}
              </p>
            </div>
          ) : (
            <p className="text-ink-2">
              {info
                ? "No evaluation results are recorded for the model currently in service."
                : "The model service is not reachable right now, so its recorded test results cannot be shown."}
            </p>
          )}
        </section>

        <section aria-labelledby="lim-h" className="mt-16">
          <h2 id="lim-h" className="text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">
            Where not to trust it
          </h2>
          <div className="mt-8 grid gap-2">
            {LIMITS.map(([h, p]) => (
              <div
                key={h}
                className="grid gap-2 rounded-[var(--radius-lg)] bg-surface p-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12"
              >
                <h3 className="text-[18px] font-medium">{h}</h3>
                <p className="max-w-[65ch] text-ink-2">{p}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="data-h" className="mt-16 max-w-[75ch]">
          <h2 id="data-h" className="text-[20px] font-medium">
            Training data
          </h2>
          <p className="mt-3 text-ink-2">
            The model was trained on the raw images of the CCMT dataset (cashew, cassava, maize and tomato) collected on
            farms in Ghana and validated by plant virologists: Mensah P. K. et al., “CCMT: Dataset for crop pest and
            disease detection”, <i>Data in Brief</i> 49 (2023) 109306, doi:10.1016/j.dib.2023.109306. Data: Mendeley
            Data, doi:10.17632/bwh3zbpkpv.1, CC BY 4.0. Duplicate photos were removed and near-identical shots were kept
            on the same side of the train/test split to avoid inflated scores.
          </p>
        </section>
      </main>
      <QuietFooter />
    </>
  );
}
