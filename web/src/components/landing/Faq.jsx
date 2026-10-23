const QA = [
  [
    "Is this a diagnosis?",
    "No. It is a preliminary, AI-assisted assessment of what the photo most looks like. It can be wrong. Confirm with your district agricultural extension officer before you spend money on treatment.",
  ],
  [
    "Which crops and problems does it know?",
    "Cashew, cassava, maize and tomato: 22 conditions in total, including healthy leaves. Any other crop or problem will still be matched to one of these 22, so the answer would not mean anything.",
  ],
  [
    "How accurate is it?",
    "The model's accuracy on a held-out set of Ghanaian field photos is published on the Limits page, together with where it tends to go wrong. Real farm photos taken with other phones may score lower.",
  ],
  [
    "What happens to my photos?",
    "They are stored privately in your history, with camera location data removed, and deleted automatically after the retention period unless you save the result. You can delete any photo or your whole account at any time.",
  ],
  [
    "Does it work without internet?",
    "Not yet. Analysing a photo needs a connection. Photos are shrunk to about 200 KB on your phone first, so a weak mobile signal is usually enough.",
  ],
  [
    "Will it tell me which chemical to spray?",
    "No. It suggests general field practices such as removing infected leaves or using clean planting material. For approved products and safe doses, ask your extension officer.",
  ],
  [
    "Can I use it in Twi or other languages?",
    "English only for now. The app is built so that Twi and other Ghanaian languages can be added once translations have been checked.",
  ],
  [
    "Who made it?",
    "It is an undergraduate final-year project, built on the openly licensed CCMT dataset of photos collected on Ghanaian farms by Mensah and colleagues (2023).",
  ],
];

export function Faq() {
  return (
    <section
      aria-labelledby="faq-h"
      className="mt-[clamp(120px,14vw,220px)] grid gap-8 px-[var(--margin)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-6"
    >
      <h2
        id="faq-h"
        className="text-[clamp(32px,4vw,56px)] font-light leading-none tracking-[-0.035em] lg:sticky lg:top-24 lg:self-start"
      >
        Fair questions
      </h2>
      <div className="grid gap-2">
        {QA.map(([q, a]) => (
          <details
            key={q}
            name="faq"
            className="group rounded-[var(--radius)] bg-surface open:bg-accent open:text-accent-ink"
          >
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-6 px-6 py-4 text-[clamp(18px,1.4vw,20px)] font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="relative h-4 w-4 shrink-0">
                <span className="absolute left-0 top-[6.5px] h-[3px] w-4 bg-current" />
                <span className="absolute left-[6.5px] top-0 h-4 w-[3px] bg-current transition-transform duration-200 group-open:rotate-90" />
              </span>
            </summary>
            <p className="max-w-[52ch] px-6 pb-6 text-[17px] leading-[1.55]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
