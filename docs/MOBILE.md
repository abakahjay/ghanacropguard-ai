# Mobile app (Android and iOS)

Expo SDK 58 / React Native 0.88 / JavaScript, one codebase for Android and iOS. The UI is native views; the JS runs on Hermes.

## Run on your phone during development
1. Start the API on your laptop: VS Code task **API 3: Run FullBackendd** (listens on `0.0.0.0:7004`). Allow Node.js through Windows Firewall when asked (Private networks).
2. Task **Mobile 1: Install**, then **Mobile 2: Start Expo**. It prints your laptop's Wi-Fi address and sets `EXPO_PUBLIC_API_URL`.
3. Phone and laptop on the same Wi-Fi. This project uses native modules that are part of Expo Go, so you can scan the QR code with **Expo Go**; if a module is missing in your Expo Go version, build a development build (`npx expo run:android` with Android Studio, or `eas build --profile development`).
4. In the app, **Server** (on the sign-in screen or Profile) lets you change the API address and tests the connection.

The Android emulator reaches the laptop at `http://10.0.2.2:7004` (the default). Production builds use `https://fullbackendd.onrender.com` (`eas.json`).

## Build an installable APK (testing)
```bash
cd mobile
npx eas-cli@latest login
# edit eas.json → build.preview.env.EXPO_PUBLIC_API_URL to your API address
npx eas-cli@latest build -p android --profile preview      # produces an .apk download link
```
The preview profile sets `ALLOW_HTTP=1` so the APK can call a plain-HTTP API on your Wi-Fi. Do not use it for public releases.

## Build for the stores
```bash
# set build.production.env.EXPO_PUBLIC_API_URL to your HTTPS API
npx eas-cli@latest build -p android --profile production   # Android App Bundle (.aab) for Google Play
npx eas-cli@latest build -p ios --profile production       # needs an Apple Developer account
npx eas-cli@latest submit -p android                       # optional: upload to Play Console
```
Local Android build without EAS (Android Studio + JDK 17 installed): `npx expo prebuild -p android && cd android && ./gradlew assembleRelease`.

## Performance choices
- Photos are resized to 1280 px and JPEG-compressed on the phone (`src/lib/image.js`) before upload: ~4 MB → ~200 KB.
- Upload uses `XMLHttpRequest` for real progress; 60 s timeout; clear offline banner (NetInfo).
- Inference runs on the server. An on-device mode with the exported `artifacts/models/mobile/model.int8.onnx` via `onnxruntime-react-native` is **planned, not implemented**; the app does not claim offline analysis.

## Tests
`npx eslint . && npx jest` — unit tests mock the camera, gallery, compression and upload (`src/__tests__`). They are not a substitute for testing on real devices.
