import { Link } from "wouter";

import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { SitePhoto } from "@/components/SitePhoto";
import { photos } from "@/lib/photos";
import { CROP_INTRO, useCrops } from "@/lib/content";
import { useTitle } from "@/lib/useTitle";
import { NotFound } from "@/pages/Errors";

const KIND = { disease: "Disease", pest: "Pest", healthy: "Healthy" };

function Loading() {
  return (
    <p role="status" className="mt-12 text-[15px] text-muted">
      Loading…
    </p>
  );
}

export function CropsPage() {
  useTitle("Crop guide");
  const { data: crops, loading } = useCrops();
  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <h1 className="max-w-[18ch] text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">
          Four crops, twenty-two conditions
        </h1>
        <p className="mt-6 max-w-[60ch] text-[length:var(--step-lead)] font-light text-ink-2">
          These are the only conditions the model was trained to recognise. Each page lists what to look for and
          practical first steps, with links to the agricultural sources behind them.
        </p>
        {loading ? (
          <Loading />
        ) : !crops ? (
          <p role="alert" className="mt-12 rounded-md bg-surface p-5 text-ink-2">
            The crop guide could not be loaded right now. Please try again shortly.
          </p>
        ) : (
          <div className="mt-16 grid gap-2 sm:grid-cols-2">
            {Object.entries(CROP_INTRO).map(([key, c]) => (
              <Link
                key={key}
                href={`/crops/${key}`}
                className="group grid min-h-[220px] content-between gap-6 overflow-hidden rounded-[var(--radius-lg)] bg-surface transition-colors hover:bg-raised sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
              >
                <div className="relative min-h-[180px] overflow-hidden">
                  <SitePhoto
                    photo={photos[key]}
                    sizes="(min-width: 640px) 20vw, 100vw"
                    showCredit={false}
                    className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="grid content-between gap-6 p-6 sm:py-8 sm:pr-8 sm:pl-0">
                <div>
                  <h2 className="text-[clamp(28px,3vw,40px)] font-light tracking-[-0.03em]">{c.name}</h2>
                  <p className="mt-2 max-w-[40ch] text-[16px] text-ink-2">{c.line}</p>
                </div>
                <p className="text-[15px] text-muted">
                  {(crops[key] ?? [])
                    .filter((x) => x.kind !== "healthy")
                    .map((x) => x.display_name)
                    .join(" · ")}
                </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <QuietFooter />
    </>
  );
}

export function CropPage({ params }) {
  const { crop } = params;
  const intro = CROP_INTRO[crop];
  useTitle(intro?.name ?? "Crop");
  const { data: crops, loading } = useCrops();
  if (!intro) return <NotFound />;
  const list = [...(crops?.[crop] ?? [])].sort((a, b) => (a.kind === "healthy" ? 1 : b.kind === "healthy" ? -1 : 0));

  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <p className="text-[15px]">
          <Link href="/crops" className="text-ink-2 hover:text-ink">
            Crop guide
          </Link>
        </p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <h1 className="text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">{intro.name}</h1>
            <p className="mt-5 max-w-[56ch] text-[length:var(--step-lead)] font-light text-ink-2">{intro.line}</p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)] bg-surface">
            <SitePhoto photo={photos[crop]} sizes="(min-width: 1024px) 40vw, 100vw" priority />
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : !crops ? (
          <p role="alert" className="mt-12 rounded-md bg-surface p-5 text-ink-2">
            This guide could not be loaded right now.
          </p>
        ) : (
          <div className="mt-14 grid gap-2">
            {list.map((c) => (
              <section
                key={c.class_key}
                id={c.class_key}
                aria-labelledby={`${c.class_key}-h`}
                className="grid gap-6 rounded-[var(--radius-lg)] bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
              >
                <div>
                  <p className="text-[14px] text-muted">{KIND[c.kind]}</p>
                  <h2
                    id={`${c.class_key}-h`}
                    className="mt-1 text-[clamp(24px,2.4vw,32px)] font-light tracking-[-0.02em]"
                  >
                    {c.display_name}
                  </h2>
                  <p className="mt-3 max-w-[48ch] text-[16px] text-ink-2">{c.summary}</p>
                </div>
                <div className="grid content-start gap-5 text-[16px]">
                  {c.signs.length > 0 && (
                    <div>
                      <h3 className="text-[15px] font-semibold">What to look for</h3>
                      <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-ink-2">
                        {c.signs.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <h3 className="text-[15px] font-semibold">First steps</h3>
                    <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-ink-2">
                      {c.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[14px] text-muted">
                    Sources:{" "}
                    {c.sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && " · "}
                        <a
                          href={s.url}
                          rel="noopener noreferrer"
                          target="_blank"
                          className="text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink"
                        >
                          {s.title}
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="mt-10 max-w-[70ch] text-[15px] text-muted">
          This guide gives general, non-chemical first steps only. For confirmation, and for advice on any approved
          crop-protection product, contact your district agricultural extension officer (Ministry of Food and
          Agriculture).
        </p>
      </main>
      <QuietFooter />
    </>
  );
}
