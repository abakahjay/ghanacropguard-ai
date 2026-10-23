import { useEffect } from "react";
import { Link } from "wouter";

import { ConfidenceBars } from "@/components/ConfidenceBars";
import { Faq } from "@/components/landing/Faq";
import { HeroReel } from "@/components/landing/HeroReel";
import { Reveal } from "@/components/landing/Reveal";
import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { SitePhoto } from "@/components/SitePhoto";
import { photos } from "@/lib/photos";
import { datasetSummary, samples } from "@/lib/samples";
import { useTitle } from "@/lib/useTitle";

export function Landing() {
  useTitle(null);
  useEffect(() => {
    // /#how from another page: scroll once the section exists
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);
  const pic = (i) => samples[i % Math.max(samples.length, 1)];

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-30">
        <SiteNav />
      </div>
      <main>
        <HeroReel samples={samples} />

        {/* Statement: a paragraph with live product fragments in place of a feature grid */}
        <section aria-labelledby="what-h" className="mt-[clamp(80px,10vw,160px)] px-[var(--margin)]">
          <h2 id="what-h" className="visually-hidden">
            What it does
          </h2>
          <Reveal
            as="p"
            className="max-w-[1100px] text-[clamp(24px,2.6vw,36px)] font-normal leading-[1.22] tracking-[-0.02em]"
          >
            Take one photo{" "}
            <Slot>
              <span className="block h-[0.62em] w-[0.62em] rounded-full border-[0.09em] border-ink" />
            </Slot>{" "}
            and the model ranks the 22 conditions it knows{" "}
            <Slot wide>
              <span className="grid w-full gap-[0.12em] px-[0.2em]">
                <span className="block h-[0.12em] w-[90%] rounded-full bg-accent" />
                <span className="block h-[0.12em] w-[30%] rounded-full bg-[#5d6b60]" />
                <span className="block h-[0.12em] w-[12%] rounded-full bg-[#5d6b60]" />
              </span>
            </Slot>{" "}
            by confidence, says when it is unsure, and lists first steps{" "}
            <Slot>
              <span className="text-[0.5em] font-medium text-accent">✓</span>
            </Slot>{" "}
            you can take today, with your extension officer as the next call.
          </Reveal>
          <Reveal delay={90} className="mt-[72px] grid gap-5 lg:ml-[50%] lg:max-w-[46ch]">
            <p className="text-[18px] text-ink-2">
              Built for phones on Ghanaian mobile data: photos are shrunk to about 200 KB before they leave your hand.
            </p>
            <Link href="/register" className="btn btn-accent justify-self-start">
              Check a leaf
            </Link>
          </Reveal>
        </section>

        {/* The four crops, each a door into its guide */}
        <section aria-labelledby="crops-h" className="mt-[clamp(100px,12vw,180px)] px-[var(--margin)]">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="crops-h" className="text-[clamp(30px,3.4vw,52px)] font-light leading-none tracking-[-0.035em]">
              Four crops Ghana grows
            </h2>
            <Link href="/crops" className="text-[16px] text-ink underline decoration-accent underline-offset-4">
              Every condition, crop by crop
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
            {CROP_TILES.map(([crop, name, line], i) => (
              <Reveal key={crop} delay={i * 60}>
                <Link
                  href={`/crops/${crop}`}
                  className="group relative block aspect-[3/4] overflow-hidden rounded-[var(--radius)] bg-surface"
                >
                  <SitePhoto
                    photo={photos[crop]}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    showCredit={false}
                    className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 grid gap-1 p-4 text-white lg:p-5">
                    <span className="text-[clamp(20px,2vw,28px)] font-medium tracking-[-0.02em]">{name}</span>
                    <span className="text-[14px] text-white/80">{line}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works: three stages down a diagonal */}
        <section id="how" aria-labelledby="how-h" className="mt-[clamp(120px,14vw,220px)] px-[var(--margin)]">
          <div className="grid gap-y-14 lg:grid-cols-12 lg:gap-x-4">
            <Reveal className="lg:col-span-4 lg:row-start-1">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[4px] bg-surface">
                <SitePhoto
                  photo={photos.maize}
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate]"
                />
                <style>{`@keyframes drift{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.1) translate(-2%,-1%)}}`}</style>
              </div>
            </Reveal>
            <Reveal delay={60} className="grid content-start gap-4 lg:col-span-5 lg:col-start-6 lg:row-start-1">
              <h2 id="how-h" className="text-[clamp(32px,4vw,64px)] font-light leading-none tracking-[-0.035em]">
                From leaf to answer
              </h2>
              <p className="max-w-[36ch] text-[17px] text-ink-2">
                <b className="font-medium text-ink">In the field,</b> hold the phone over one affected leaf in daylight,
                or pick a photo you already took. Close and sharp beats wide and pretty.
              </p>
            </Reveal>

            <Reveal className="lg:col-span-3 lg:col-start-6 lg:row-start-2 lg:-mt-[60px]">
              <div data-ui className="grid aspect-square content-center gap-4 rounded-[4px] bg-surface p-6 text-[15px]">
                <p className="text-muted">Photo size</p>
                <p className="tabular text-[clamp(26px,2.4vw,34px)] font-light leading-tight">
                  3.8 MB <span className="text-muted">→</span> 210 KB
                </p>
                <div className="grid gap-1.5">
                  <div className="h-2 rounded-full bg-raised">
                    <div className="h-2 w-[5.4%] rounded-full bg-ink" />
                  </div>
                  <p className="text-[13px] text-muted">
                    Example: a 12 MP phone photo resized to 1280 px on the device
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={60} className="lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:-mt-[60px]">
              <p className="max-w-[36ch] text-[17px] text-ink-2">
                <b className="font-medium text-ink">Before it leaves your phone,</b> the photo is resized and
                compressed, so it uploads quickly even on a weak 3G signal and costs little data.
              </p>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-4 lg:col-start-1 lg:row-start-3 lg:self-start lg:text-right">
              <p className="max-w-[36ch] text-[17px] text-ink-2 lg:ml-auto">
                <b className="font-medium text-ink">Seconds later,</b> you see the most likely condition, how sure the
                model is, the next two possibilities and what to do now. Low-confidence results are clearly marked.
              </p>
            </Reveal>
            <Reveal className="lg:col-span-5 lg:col-start-8 lg:row-start-3">
              <div data-ui className="grid gap-5 rounded-[4px] bg-surface p-5 sm:p-6">
                {pic(1) ? (
                  <ConfidenceBars items={pic(1).top3} />
                ) : (
                  <p className="text-[15px] text-muted">
                    Example results appear here once the model has been trained and exported.
                  </p>
                )}
                <ol className="grid list-decimal gap-1.5 pl-5 text-[15px] text-ink-2">
                  <li>Plant cuttings only from healthy plants</li>
                  <li>Uproot infected plants early</li>
                  <li>Ask your extension officer about resistant varieties</li>
                </ol>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Proof: the data the model is built on, as large marks on tiles */}
        <section aria-labelledby="proof-h" className="mt-[clamp(120px,14vw,220px)] px-[var(--margin)]">
          <div className="grid grid-cols-2 gap-[6px] lg:grid-cols-4 lg:gap-2">
            <Reveal className="col-span-2 flex h-[120px] items-start rounded-[var(--radius)] bg-accent p-6 text-accent-ink lg:h-[220px]">
              <h2 id="proof-h" className="text-[clamp(28px,3vw,44px)] font-light leading-[1.05] tracking-[-0.03em]">
                Built on photos from Ghanaian farms
              </h2>
            </Reveal>
            {[
              ...datasetSummary.crops.map((c) => [c.name, `${c.images.toLocaleString("en-GB")} photos`]),
              ["CCMT dataset", "Mensah et al., 2023"],
              ["Expert-validated", "by plant virologists"],
            ].map(([n, sub], i) => (
              <Reveal
                key={n}
                delay={i * 50}
                className="grid h-[140px] content-between rounded-[var(--radius)] bg-surface p-5 lg:h-[220px] lg:p-6"
              >
                <p className="text-[clamp(20px,2.2vw,32px)] font-medium leading-tight tracking-[-0.02em]">{n}</p>
                <p className="text-[14px] text-muted">{sub}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Stats: the total and its receipt */}
        <section
          aria-labelledby="count-h"
          className="mt-[clamp(120px,14vw,220px)] grid gap-10 px-[var(--margin)] lg:grid-cols-12 lg:gap-4"
        >
          <div className="flex flex-col lg:col-span-6">
            <Reveal>
              <h2 id="count-h" className="text-[clamp(30px,3vw,44px)] font-light leading-[1.05] tracking-[-0.03em]">
                Every photo, counted
              </h2>
              <p className="mt-3 max-w-[44ch] text-[16px] text-ink-2">
                The raw photos as published, before duplicates and unreadable files were removed for training.
              </p>
            </Reveal>
            <Reveal delay={90} className="mt-10 lg:mt-auto">
              <p className="tabular text-[clamp(88px,18vw,300px)] font-light leading-[0.8] tracking-[-0.05em]">
                {datasetSummary.total.toLocaleString("en-GB")}
              </p>
              <p className="mt-4 text-[17px] text-ink-2">photos across four crops and 22 conditions</p>
            </Reveal>
          </div>
          <Reveal delay={60} className="lg:col-span-4 lg:col-start-8">
            <Receipt />
          </Reveal>
        </section>

        <Faq />

        {/* CTA: the action tile, cropped from a longer row */}
        <section aria-labelledby="cta-h" className="mt-[clamp(120px,14vw,220px)] grid gap-2 lg:grid-cols-12 lg:gap-3">
          <div className="relative hidden h-[360px] overflow-hidden rounded-r-[var(--radius)] bg-surface lg:col-span-2 lg:block">
            <SitePhoto photo={photos.farmers} sizes="17vw" showCredit={false} />
          </div>
          <div className="mx-[var(--margin)] flex min-h-[300px] flex-col justify-center gap-4 rounded-[var(--radius)] bg-accent p-8 text-accent-ink lg:col-span-8 lg:mx-0 lg:h-[360px] lg:p-10">
            <h2 id="cta-h" className="text-[clamp(28px,2.8vw,40px)] font-light leading-[1.05] tracking-[-0.03em]">
              Check your first leaf
            </h2>
            <p className="max-w-[48ch] text-[17px]">
              Free to use. Make an account so your results stay private and you can look back at them.
            </p>
            <Link href="/register" className="btn self-start bg-accent-ink text-accent hover:bg-black">
              Create an account
            </Link>
          </div>
          <div className="mx-[var(--margin)] grid grid-cols-2 gap-2 lg:hidden">
            <div className="relative h-[120px] overflow-hidden rounded-[var(--radius)] bg-surface">
              <SitePhoto photo={photos.farmers} sizes="50vw" showCredit={false} />
            </div>
            <div className="relative h-[120px] overflow-hidden rounded-[var(--radius)] bg-raised">
              <SitePhoto photo={photos.harvest} sizes="50vw" showCredit={false} />
            </div>
          </div>
          <div className="relative hidden h-[360px] overflow-hidden rounded-l-[var(--radius)] bg-raised lg:col-span-2 lg:block">
            <SitePhoto photo={photos.harvest} sizes="17vw" showCredit={false} />
          </div>
        </section>
      </main>
      <QuietFooter />
    </>
  );
}

function Slot({ children, wide = false }) {
  return (
    <span
      data-ui
      aria-hidden="true"
      className={`relative inline-flex h-[1em] translate-y-[0.12em] items-center justify-center rounded-[0.18em] bg-surface align-baseline ${wide ? "w-[1.9em]" : "w-[1.5em] sm:w-[1.9em]"}`}
    >
      {children}
    </span>
  );
}

const CROP_TILES = [
  ["cassava", "Cassava", "Mosaic, brown spot, green mite…"],
  ["maize", "Maize", "Fall armyworm, streak virus…"],
  ["tomato", "Tomato", "Leaf curl, septoria, blight…"],
  ["cashew", "Cashew", "Anthracnose, red rust, leaf miner…"],
];

function Receipt() {
  const d = datasetSummary;
  return (
    <div className="mx-auto w-full max-w-[440px] bg-field pb-8 text-field-ink [clip-path:polygon(0_0,100%_0,100%_calc(100%-10px),95%_100%,90%_calc(100%-10px),85%_100%,80%_calc(100%-10px),75%_100%,70%_calc(100%-10px),65%_100%,60%_calc(100%-10px),55%_100%,50%_calc(100%-10px),45%_100%,40%_calc(100%-10px),35%_100%,30%_calc(100%-10px),25%_100%,20%_calc(100%-10px),15%_100%,10%_calc(100%-10px),5%_100%,0_calc(100%-10px))]">
      <div className="grid gap-4 p-6 text-[15px]">
        <p className="text-[13px]">CCMT raw images · Mendeley Data v1</p>
        {d.crops.map((c) => (
          <div key={c.crop} className="grid gap-1.5">
            <Row label={c.name} value={c.images} bold />
            {c.classes.map((k) => (
              <Row key={k.key} label={k.name} value={k.images} />
            ))}
          </div>
        ))}
        <div className="-mx-6 mt-2 flex items-baseline justify-between bg-field-ink px-6 py-2.5 text-field">
          <span>Total</span>
          <span className="tabular">{d.total.toLocaleString("en-GB")}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className={`flex items-baseline gap-2 ${bold ? "font-semibold" : "pl-3"}`}>
      <span className="shrink-0">{label}</span>
      <span aria-hidden="true" className="mb-[4px] flex-1 self-end border-b-[3px] border-dotted border-field-ink/40" />
      <span className="tabular shrink-0">{value.toLocaleString("en-GB")}</span>
    </div>
  );
}
