import { newerRelease } from "@/lib/appUpdate";

// jest.mock calls are hoisted above the import.
jest.mock("expo-application", () => ({ nativeBuildVersion: "2" }));
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: {} }));
jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn() }));


const manifest = (android) => ({ android });
const ok = { versionCode: 3, versionName: "1.2.0", url: "https://github.com/x/GhanaCropGuard.apk", size: "61 MB", notes: ["New"] };

test("offers a release with a higher versionCode", () => {
  expect(newerRelease(manifest(ok), 2)).toEqual({ versionCode: 3, versionName: "1.2.0", url: ok.url, size: "61 MB", notes: ["New"] });
});

test("ignores the same or an older version", () => {
  expect(newerRelease(manifest({ ...ok, versionCode: 2 }), 2)).toBeNull();
  expect(newerRelease(manifest({ ...ok, versionCode: 1 }), 2)).toBeNull();
});

test("ignores broken manifests and non-HTTPS links", () => {
  expect(newerRelease(null, 2)).toBeNull();
  expect(newerRelease({}, 2)).toBeNull();
  expect(newerRelease(manifest({ ...ok, url: "http://evil.example/app.apk" }), 2)).toBeNull();
  expect(newerRelease(manifest({ ...ok, versionCode: "3.5" }), 2)).toBeNull();
});

test("does nothing where updates are not supported (iOS, Expo Go)", () => {
  expect(newerRelease(manifest(ok), null)).toBeNull();
});
