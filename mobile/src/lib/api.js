import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/*
  API client for the CropGuard API on FullBackendd (the same one the web app uses).
  - Base URL: the FullBackendd origin. Settings override (SecureStore) > EXPO_PUBLIC_API_URL >
    app.config.js extra.apiUrl. Every route lives under API_PREFIX on that server.
  - Token: kept in the device keystore via expo-secure-store, never in plain storage.
*/
const TOKEN_KEY = "cg_token";
const URL_KEY = "cg_api_url";
export const API_PREFIX = "/api/v1/cropguard";

let token = null;
let baseUrl = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://10.0.2.2:7004";
let onUnauthorized = null;

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
  0: "No connection. Check your mobile data or Wi-Fi and try again.",
  401: "Your session has ended. Please sign in again.",
  413: "That photo is too large.",
  429: "Too many requests. Please wait a minute and try again.",
  502: "The service is not reachable right now.",
  503: "The AI model is not available right now. No prediction was made.",
};

export async function loadSession() {
  const [t, u] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(URL_KEY)]);
  token = t;
  if (u) baseUrl = u;
  return t;
}

export async function setToken(t) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function getBaseUrl() {
  return baseUrl;
}

export async function setBaseUrl(u) {
  const clean = u.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/.test(clean))
    throw new ApiError(400, "bad_url", "Enter a full address such as http://192.168.1.20:7004");
  baseUrl = clean;
  await SecureStore.setItemAsync(URL_KEY, clean);
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function absoluteUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${baseUrl}${path}`;
}

function toError(status, body) {
  const d = body?.detail;
  return new ApiError(
    status,
    d?.code ?? "error",
    d?.message ?? FRIENDLY[status] ?? "Something went wrong.",
    d?.fields ?? [],
  );
}

export async function api(path, init = {}, timeoutMs = 20000) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");
  // The timeout covers reading the body too: a connection that dies mid-response (the server
  // restarting, a dropped mobile signal) otherwise leaves r.json() waiting forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  let body = null;
  try {
    r = await fetch(`${baseUrl}${API_PREFIX}${path}`, { ...init, headers, signal: ctrl.signal });
    if (r.status === 204) return undefined;
    const text = await r.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
  } catch {
    throw new ApiError(0, "network", FRIENDLY[0]);
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    if (r.status === 401 && token) onUnauthorized?.();
    throw toError(r.status, body);
  }
  return body;
}

/**
 * Upload a photo with progress. Uses XMLHttpRequest because fetch has no upload progress.
 * The photo must already be compressed (see compressForUpload).
 */
export function uploadPrediction(uri, onProgress, onUploaded) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}${API_PREFIX}/predictions`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 60000;
    // The server can answer (e.g. 401) before the upload finishes; late upload events
    // must not move the screen back to "analysing" after that.
    let done = false;
    xhr.upload.onprogress = (e) => {
      if (!done && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.upload.onload = () => !done && onUploaded?.();
    xhr.onloadend = () => {
      done = true;
    };
    xhr.onload = () => {
      done = true;
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status === 201) resolve(body);
      else {
        if (xhr.status === 401) onUnauthorized?.();
        reject(toError(xhr.status, body));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "network", FRIENDLY[0]));
    xhr.ontimeout = () =>
      reject(new ApiError(0, "timeout", "The upload took too long. Try again where the signal is stronger."));
    const fd = new FormData();
    // React Native FormData accepts a { uri, name, type } file descriptor
    fd.append("image", { uri, name: "leaf.jpg", type: "image/jpeg" });
    fd.append("client", "mobile");
    xhr.send(fd);
  });
}
