import { Link } from "wouter";

import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { useTitle } from "@/lib/useTitle";

const VERSION = "2026-10-22";

const SECTIONS = [
  {
    h: "What the service is",
    p: [
      "GhanaCropGuard AI gives an automated, preliminary assessment of photos of cashew, cassava, maize and tomato leaves. It is an aid, not a diagnosis, and it can be wrong. Decisions about treatment, spraying or destroying crops are yours; confirm with a qualified agricultural extension officer first.",
    ],
  },
  {
    h: "Who may use it",
    p: [
      "You must be 16 or older to create an account. Keep your password private; you are responsible for activity on your account.",
    ],
  },
  {
    h: "Your photos",
    p: [
      "Upload only photos you took yourself or are allowed to share. Do not upload photos of people, documents or anything unrelated to crops. Your photos stay private to your account; you keep any rights you have in them and give the operator permission to store and process them only to provide the service to you.",
      "If you believe content on the service infringes your rights or is unlawful, contact the operator (see below) and it will be reviewed and removed where appropriate.",
    ],
  },
  {
    h: "Acceptable use",
    p: [
      "Do not try to break, overload or reverse-engineer the service, access other people's data, or use it in a way that breaks the law. Automated bulk use requires the operator's permission.",
    ],
  },
  {
    h: "No warranty",
    p: [
      "The service is provided free of charge and “as is”, without any guarantee of accuracy or availability. To the extent the law allows, the operator is not liable for crop losses or other damage arising from reliance on a prediction.",
    ],
  },
  {
    h: "Changes and contact",
    p: [
      <>
        These terms may be updated; the version date is shown below. The operator of each deployment must add their name
        and a contact address here before going live. See also the{" "}
        <Link href="/privacy" className="text-ink underline decoration-accent underline-offset-4">
          privacy notice
        </Link>
        .
      </>,
    ],
  },
];

export function TermsPage() {
  useTitle("Terms of Use");
  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <h1 className="text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">Terms of Use</h1>
        <p className="mt-5 max-w-[60ch] text-[length:var(--step-lead)] font-light text-ink-2">
          The rules for using the service, in plain words.
        </p>
        <div className="mt-14 grid max-w-[1100px] gap-10">
          {SECTIONS.map((s) => (
            <section key={s.h} className="grid gap-3 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
              <h2 className="text-[20px] font-medium">{s.h}</h2>
              <div className="grid gap-3 text-ink-2">
                {s.p.map((t, i) => (
                  <p key={i} className="max-w-[65ch]">
                    {t}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-12 text-[14px] text-muted">Version {VERSION}</p>
      </main>
      <QuietFooter />
    </>
  );
}
