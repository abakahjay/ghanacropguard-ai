import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { useTitle } from "@/lib/useTitle";

const SECTIONS = [
  {
    h: "What we collect",
    p: [
      "Your email address and a password (stored only as a one-way bcrypt hash). Optionally your name and your region of Ghana. We do not ask for, or record, your exact location.",
      "The photos you check and the model's result for each, so you can look back at them. Photos are re-encoded on our server, which removes camera metadata such as GPS coordinates.",
    ],
  },
  {
    h: "Why",
    p: [
      "To give you a result and keep your history. Region and anonymous totals are used to produce usage statistics for administrators (for example, how many maize checks were made). Administrators see counts, not your photos.",
    ],
  },
  {
    h: "Who can see your photos",
    p: ["Only you, when signed in. Image links expire after one hour. Other users cannot open your results."],
  },
  {
    h: "How long we keep them",
    p: [
      "Photos are deleted automatically after the retention period set by the operator (90 days by default) unless you saved the result. Results without photos stay in your history until you delete them.",
    ],
  },
  {
    h: "Your controls",
    p: [
      "Delete any single result, delete your whole history, or delete your account and everything in it, from your profile page. Deletion is immediate and permanent.",
    ],
  },
  {
    h: "Who can use it",
    p: [
      "You must be 16 or older to create an account. We do not knowingly collect data from younger children; if you believe a child has made an account, contact the operator and it will be deleted.",
    ],
  },
  {
    h: "Contact and law",
    p: [
      "This service should be operated in line with Ghana's Data Protection Act, 2012 (Act 843). The operator of this deployment is responsible for registering with the Data Protection Commission where required and for answering data requests. Deployments must replace this paragraph with the operator's name and contact address.",
    ],
  },
];

export function PrivacyPage() {
  useTitle("Privacy");
  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <h1 className="text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">Privacy</h1>
        <p className="mt-5 max-w-[60ch] text-[length:var(--step-lead)] font-light text-ink-2">
          What happens to your photos and your account, in plain words.
        </p>
        <div className="mt-14 grid max-w-[1100px] gap-10">
          {SECTIONS.map((s) => (
            <section key={s.h} className="grid gap-3 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
              <h2 className="text-[20px] font-medium">{s.h}</h2>
              <div className="grid gap-3 text-ink-2">
                {s.p.map((t) => (
                  <p key={t} className="max-w-[65ch]">
                    {t}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <QuietFooter />
    </>
  );
}
