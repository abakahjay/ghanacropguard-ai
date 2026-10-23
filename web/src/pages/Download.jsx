import { useEffect, useState } from "react";
import { Link } from "wouter";

import { QuietFooter, SiteNav } from "@/components/SiteNav";
import { SitePhoto } from "@/components/SitePhoto";
import { photos } from "@/lib/photos";
import { useTitle } from "@/lib/useTitle";

// The Android APK is published as a GitHub Release asset (APKs are not kept in git).
export const APK_URL = "https://github.com/abakahjay/ghanacropguard-ai/releases/latest/download/GhanaCropGuard.apk";

function device() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

export function DownloadPage() {
  useTitle("Get the app");
  const [kind] = useState(device);
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setInstallEvent(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  const android = (
    <section aria-labelledby="android-h" className="grid gap-4 rounded-[var(--radius-lg)] bg-surface p-6 sm:p-8">
      <h2 id="android-h" className="text-[clamp(22px,2.2vw,28px)] font-light tracking-[-0.02em]">
        Android phone
      </h2>
      <p className="max-w-[56ch] text-[16px] text-ink-2">
        Download the app file (about 60 MB), open it, and allow your browser to install apps when Android asks. It
        works on Android 7 and newer and uses about 200 KB of data per photo you check.
      </p>
      <a href={APK_URL} className="btn btn-accent justify-self-start" rel="noopener">
        Download for Android (.apk)
      </a>
      <p className="text-[14px] text-muted">
        Not on the Play Store yet, so Android shows a warning for apps from outside the store. The file comes
        straight from this project&apos;s release page on GitHub.
      </p>
    </section>
  );

  const web = (
    <section aria-labelledby="web-h" className="grid gap-4 rounded-[var(--radius-lg)] bg-surface p-6 sm:p-8">
      <h2 id="web-h" className="text-[clamp(22px,2.2vw,28px)] font-light tracking-[-0.02em]">
        {kind === "ios" ? "iPhone and iPad" : "Install the web app"}
      </h2>
      {kind === "ios" ? (
        <ol className="grid max-w-[56ch] list-decimal gap-2 pl-5 text-[16px] text-ink-2">
          <li>Open this site in Safari.</li>
          <li>
            Tap the Share button, then <b className="font-medium text-ink">Add to Home Screen</b>.
          </li>
          <li>Open GhanaCropGuard from your Home Screen. It works like an app, with its own icon.</li>
        </ol>
      ) : installed ? (
        <p role="status" className="text-[16px] text-ink-2">
          Installed. Open GhanaCropGuard from your apps or home screen.
        </p>
      ) : installEvent ? (
        <>
          <p className="max-w-[56ch] text-[16px] text-ink-2">
            Adds GhanaCropGuard to your computer or phone with its own icon and window. Nothing to download from a
            store.
          </p>
          <button type="button" className="btn btn-accent justify-self-start" onClick={install}>
            Install GhanaCropGuard
          </button>
        </>
      ) : (
        <p className="max-w-[56ch] text-[16px] text-ink-2">
          In Chrome or Edge, use the install icon in the address bar, or the browser menu, then{" "}
          <b className="font-medium text-ink">Install GhanaCropGuard AI</b>. Or simply keep using it here in the
          browser.
        </p>
      )}
      <Link href="/app" className="text-[15px] text-ink underline decoration-accent underline-offset-4">
        Or open it in the browser now
      </Link>
    </section>
  );

  return (
    <>
      <SiteNav />
      <main className="px-[var(--margin)] pt-10 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <h1 className="text-[length:var(--step-head)] font-light leading-none tracking-[-0.035em]">Get the app</h1>
            <p className="mt-5 max-w-[56ch] text-[length:var(--step-lead)] font-light text-ink-2">
              Check leaves in the field with your phone&apos;s camera. Your account and history are the same on the
              app and the website.
            </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)] bg-surface">
            <SitePhoto photo={photos.farmers} sizes="(min-width: 1024px) 40vw, 100vw" priority />
          </div>
        </div>
        <div className="mt-12 grid gap-2 lg:grid-cols-2">
          {kind === "ios" ? (
            <>
              {web}
              {android}
            </>
          ) : (
            <>
              {android}
              {web}
            </>
          )}
        </div>
      </main>
      <QuietFooter />
    </>
  );
}
