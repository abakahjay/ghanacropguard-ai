/*
  EXPO_PUBLIC_API_URL  backend base URL baked into the build (e.g. https://api.example.org)
  ALLOW_HTTP=1         allow plain-HTTP traffic on Android (only for testing against a laptop on Wi-Fi)
*/
const allowHttp = process.env.ALLOW_HTTP === "1";

module.exports = ({ config }) => ({
  ...config,
  name: "GhanaCropGuard AI",
  slug: "ghanacropguard-ai",
  scheme: "ghanacropguard",
  // Bump both for every Android release, then update web/public/app-version.json (in-app updates).
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0b120d",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "org.ghanacropguard.app",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "org.ghanacropguard.app",
    versionCode: 2,
    // In-app updates: the app downloads the new APK and opens Android's installer (src/lib/appUpdate.js).
    permissions: ["android.permission.REQUEST_INSTALL_PACKAGES"],
    adaptiveIcon: {
      backgroundColor: "#0b120d",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-image",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: "#0b120d" }],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a photo of a crop leaf from your gallery to check it for diseases and pests.",
        cameraPermission: "Take a photo of a crop leaf to check it for diseases and pests.",
        microphonePermission: false,
      },
    ],
    ["expo-build-properties", { android: { usesCleartextTraffic: allowHttp } }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:7004",
    // The website: password-reset links from emails open its /reset-password page.
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? "https://ghanacropguard-web.onrender.com",
  },
});
