
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { useToast } from "@/components/Toast";
import { compressImage, formatBytes, uploadPrediction } from "@/lib/client";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function UploadWorkspace() {
  const [, navigate] = useLocation();
  const toast = useToast();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [stage, setStage] = useState({ kind: "empty" });
  const [dragging, setDragging] = useState(false);

  // Revoke a preview URL only once no stage uses it (ready → uploading → analysing share one).
  const stageUrl = "url" in stage ? stage.url : undefined;
  useEffect(
    () => () => {
      if (stageUrl) URL.revokeObjectURL(stageUrl);
    },
    [stageUrl],
  );

  async function take(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStage({ kind: "error", message: "That file is not a photo. Choose a JPEG, PNG or WebP image." });
      return;
    }
    setStage({ kind: "preparing" });
    try {
      const { blob, width, height } = await compressImage(file);
      setStage({
        kind: "ready",
        blob,
        width,
        height,
        url: URL.createObjectURL(blob),
        original: file.size,
        name: file.name,
      });
    } catch {
      setStage({
        kind: "error",
        message: "We could not open this photo on your device. Try another photo, or take a new one.",
      });
    }
  }

  async function upload(s) {
    setStage({ ...s, kind: "uploading", progress: 0 });
    try {
      const body = await uploadPrediction(s.blob, (s.name.replace(/\.[^.]+$/, "") || "leaf") + ".jpg", {
        onProgress: (progress) => setStage({ ...s, kind: "uploading", progress }),
        onUploaded: () => setStage({ kind: "analysing", url: s.url }),
      });
      navigate(`/app/results/${body.id}`);
    } catch (e) {
      if (e.code === "not_a_leaf") {
        // The model can only judge crop leaves: ask for one instead of showing a made-up result.
        toast("Please upload a photo of a leaf. That photo doesn't look like a cashew, cassava, maize or tomato leaf.");
        setStage({ kind: "empty" });
        return;
      }
      if (e.status === 401) {
        // The auth handler is already sending the user to sign in; don't leave a spinner meanwhile.
        setStage({ kind: "error", url: s.url, message: e.message });
        return;
      }
      setStage({
        kind: "error",
        url: s.url,
        retry: () => upload(s),
        message:
          e.code === "network"
            ? "The upload did not go through. Check your internet connection and try again."
            : e.message || `Upload failed (error ${e.status}). Please try again.`,
      });
    }
  }

  const reset = () => setStage({ kind: "empty" });
  const preview = "url" in stage ? stage.url : undefined;

  return (
    <section aria-labelledby="upload-h" className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
      <div
        className={`relative flex min-h-[340px] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-surface transition-colors lg:min-h-[460px] ${
          dragging ? "bg-raised" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
      >
        <h2 id="upload-h" className="visually-hidden">
          Photo
        </h2>
        {preview ? (
          <img
            src={preview}
            alt="Your photo, ready to check"
            className="h-full max-h-[560px] w-full flex-1 object-contain bg-black/30"
          />
        ) : (
          <div className="flex flex-1 flex-col items-start justify-end gap-5 p-6 lg:p-8">
            {stage.kind === "preparing" ? (
              <p className="text-[17px] text-ink-2" role="status">
                Preparing your photo…
              </p>
            ) : (
              <>
                <p className="max-w-[30ch] text-[clamp(22px,2.2vw,28px)] font-light leading-[1.2] tracking-[-0.02em]">
                  Photograph one leaf, close up, in daylight.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
                    Take photo
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => galleryRef.current?.click()}>
                    Choose from gallery
                  </button>
                </div>
                <p className="hidden text-[14px] text-muted sm:block">or drop a photo here</p>
              </>
            )}
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-5">
        {stage.kind === "empty" || stage.kind === "preparing" ? <Tips /> : null}

        {(stage.kind === "ready" || stage.kind === "uploading") && (
          <div className="grid gap-5 rounded-[var(--radius-lg)] bg-surface p-5">
            <dl className="grid grid-cols-2 gap-4 text-[15px]">
              <div>
                <dt className="text-muted">Original</dt>
                <dd className="tabular">{formatBytes(stage.original)}</dd>
              </div>
              <div>
                <dt className="text-muted">Sending</dt>
                <dd className="tabular">
                  {formatBytes(stage.blob.size)} · {stage.width}×{stage.height}
                </dd>
              </div>
            </dl>
            {stage.kind === "uploading" ? (
              <div role="status" aria-live="polite" className="grid gap-2">
                <div className="flex justify-between text-[15px]">
                  <span>Uploading</span>
                  <span className="tabular">{Math.round(stage.progress * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-raised">
                  <div
                    className="h-2 rounded-full bg-ink transition-[width] duration-200"
                    style={{ width: `${stage.progress * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-accent" onClick={() => upload(stage)}>
                  Check this leaf
                </button>
                <button type="button" className="btn btn-quiet" onClick={reset}>
                  Retake
                </button>
              </div>
            )}
          </div>
        )}

        {stage.kind === "analysing" && (
          <div role="status" aria-live="polite" className="grid gap-3 rounded-[var(--radius-lg)] bg-surface p-5">
            <p className="text-[17px]">Analysing the photo…</p>
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-2 w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-full bg-ink" />
            </div>
            <p className="text-[14px] text-muted">This usually takes under a second once the photo arrives.</p>
          </div>
        )}

        {stage.kind === "error" && (
          <div role="alert" className="grid gap-4 rounded-[var(--radius-lg)] bg-[var(--danger-bg)] p-5">
            <p className="text-[16px] text-[var(--danger-ink)]">{stage.message}</p>
            <div className="flex flex-wrap gap-3">
              {stage.retry && (
                <button type="button" className="btn btn-primary" onClick={stage.retry}>
                  Try again
                </button>
              )}
              <button type="button" className="btn btn-quiet" onClick={reset}>
                Choose another photo
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </section>
  );
}

function Tips() {
  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] bg-surface p-5">
      <h2 className="text-[15px] font-semibold">For a useful result</h2>
      <ul className="grid gap-2.5 text-[15px] text-ink-2">
        <li>Fill the frame with the affected leaf, stem or pod.</li>
        <li>Use daylight; avoid strong shadow across the leaf.</li>
        <li>Hold steady so the spots or insects are sharp.</li>
        <li>Works for cashew, cassava, maize and tomato only.</li>
      </ul>
      <p className="text-[14px] text-muted">
        Your photo is resized on this device to about 200 KB before sending, to save data.
      </p>
    </div>
  );
}
