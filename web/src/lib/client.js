/*
  Browser client for the CropGuard API on FullBackendd (/api/v1/cropguard/*).
  The token lives in localStorage and is sent as a Bearer header (no cookies, so no CSRF);
  the hosting CSP only lets scripts from this site run, and React escapes everything rendered.
*/
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:7004").replace(/\/$/, "");
export const API_BASE = `${API_URL}/api/v1/cropguard`;
const TOKEN_KEY = "cg_token";

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: the session lasts for this tab only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status;
  code;
  fields;
  constructor(status, code, message, fields = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const FRIENDLY = {
  0: "You appear to be offline. Check your connection and try again.",
  401: "Your session has ended. Please sign in again.",
  413: "That photo is too large. Try a smaller one.",
  429: "Too many requests. Please wait a minute and try again.",
  502: "The service is not reachable right now. Please try again shortly.",
  503: "The AI model is not available right now. No prediction was made.",
};

let onUnauthorized = null;
/** Called when a signed-in request comes back 401 (expired or revoked session). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function toError(status, body) {
  const d = body?.detail;
  return new ApiError(status, d?.code ?? "error", d?.message ?? FRIENDLY[status] ?? "Something went wrong.", d?.fields ?? []);
}

/** JSON call to the API. `init` is fetch's; a plain-object `json` is sent as the body. */
export async function api(path, { json, ...init } = {}) {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(json);
  }
  let r;
  try {
    r = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network", FRIENDLY[0]);
  }
  if (r.status === 204) return undefined;
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && token && onUnauthorized) onUnauthorized();
    throw toError(r.status, body);
  }
  return body;
}

/** Image links from the API are paths on the API server (signed, valid for an hour). */
export function absoluteUrl(path) {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

/** Multipart upload with progress (fetch has no upload progress). Resolves with the prediction. */
export function uploadPrediction(blob, filename, { onProgress, onUploaded } = {}) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("image", blob, filename);
    fd.append("client", "web");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/predictions`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // The server can answer (e.g. 401) before the body has finished uploading; after that,
    // late upload events must not move the UI back to "analysing".
    let done = false;
    xhr.upload.onprogress = (e) => {
      if (!done && e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.upload.onload = () => !done && onUploaded?.();
    xhr.onerror = () => {
      done = true;
      reject(new ApiError(0, "network", FRIENDLY[0]));
    };
    xhr.ontimeout = xhr.onerror;
    xhr.timeout = 60_000;
    xhr.onload = () => {
      done = true;
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status === 201) return resolve(body);
      if (xhr.status === 401 && token && onUnauthorized) onUnauthorized();
      reject(toError(xhr.status, body));
    };
    xhr.send(fd);
  });
}

/**
 * Shrink a phone photo before upload: EXIF-aware decode, longest side 1280px, JPEG q=0.85.
 * A 4 MB camera photo typically becomes ~150-300 KB, which matters on mobile data.
 */
export async function compressImage(file, maxSide = 1280, quality = 0.85) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode image"))), "image/jpeg", quality),
  );
  return { blob, width: w, height: h };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function pct(x, digits = 0) {
  return `${(x * 100).toFixed(digits)}%`;
}

/**
 * Start Google sign-in on FullBackendd. It comes back to /auth/google with #token= or #error=.
 * `consent` is true only from the sign-up form once the age and terms boxes are ticked.
 */
export function googleSignInUrl({ consent = false } = {}) {
  const q = new URLSearchParams({ app: "cropguard", redirect_uri: `${window.location.origin}/auth/google` });
  if (consent) q.set("consent", "1");
  return `${API_URL}/api/v1/auth/google?${q}`;
}

/** Where to land after Google sign-in (read by /auth/google). Call when the user clicks the button. */
export function rememberNext(next) {
  try {
    sessionStorage.setItem("cg_next", safeNext(next));
  } catch {
    /* private mode: land on /app */
  }
}

/** `?next=` values must stay on this site. */
export function safeNext(next, fallback = "/app") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
