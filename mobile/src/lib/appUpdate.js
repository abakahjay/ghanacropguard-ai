import * as Application from "expo-application";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Linking, Platform } from "react-native";

/*
  In-app updates for the Android APK (it is not on the Play Store).
  The website publishes /app-version.json:
    { "android": { "versionCode": 2, "versionName": "1.1.0", "url": "https://.../GhanaCropGuard.apk",
                   "size": "61 MB", "notes": ["..."] } }
  If its versionCode is higher than this build's (android.versionCode in app.config.js), the app
  offers the update, downloads the APK into the cache and hands it to Android's package installer.
*/

const APK_MIME = "application/vnd.android.package-archive";
const FLAG_GRANT_READ_URI_PERMISSION = 1; // android.content.Intent

export function versionUrl() {
  const web = Constants.expoConfig?.extra?.webUrl ?? "https://ghanacropguard-web.onrender.com";
  return `${web.replace(/\/$/, "")}/app-version.json`;
}

/** The installed build's versionCode, or null where in-app updates don't apply (iOS, Expo Go, web). */
export function installedVersionCode() {
  if (Platform.OS !== "android" || Constants.executionEnvironment === "storeClient") return null; // storeClient = Expo Go
  const code = Number(Application.nativeBuildVersion);
  return Number.isFinite(code) && code > 0 ? code : null;
}

/** Pure comparison so it can be unit-tested: returns the newer release, or null. */
export function newerRelease(manifest, currentCode) {
  const a = manifest?.android;
  if (!a || currentCode == null) return null;
  const code = Number(a.versionCode);
  if (!Number.isInteger(code) || code <= currentCode) return null;
  if (typeof a.url !== "string" || !a.url.startsWith("https://")) return null;
  return {
    versionCode: code,
    versionName: String(a.versionName || code),
    url: a.url,
    size: typeof a.size === "string" ? a.size : null,
    notes: Array.isArray(a.notes) ? a.notes.filter((n) => typeof n === "string").slice(0, 6) : [],
  };
}

/** Fetches the published version; resolves to the newer release or null (never throws). */
export async function checkForUpdate() {
  const current = installedVersionCode();
  if (current == null) return null;
  try {
    const res = await fetch(`${versionUrl()}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return newerRelease(await res.json(), current);
  } catch {
    return null; // offline or the site is asleep: try again next launch
  }
}

/**
 * Downloads the APK with progress (0..1) and opens Android's installer. If the in-app download
 * fails, falls back to opening the link so the browser downloads it.
 */
export async function downloadAndInstall(release, onProgress = () => {}) {
  try {
    const target = new File(Paths.cache, "GhanaCropGuard-update.apk");
    if (target.exists) target.delete();
    const task = File.createDownloadTask(release.url, target, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) onProgress(Math.min(1, bytesWritten / totalBytes));
      },
    });
    const file = await task.downloadAsync();
    if (!file) throw new Error("Download did not finish");
    onProgress(1);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: file.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
    return "installer";
  } catch {
    await Linking.openURL(release.url);
    return "browser";
  }
}
