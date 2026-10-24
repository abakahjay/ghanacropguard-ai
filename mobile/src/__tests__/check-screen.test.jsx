import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CheckScreen from "@/app/(tabs)/index";
import { ToastProvider } from "@/components/Toast";
import * as api from "@/lib/api";
import * as image from "@/lib/image";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a) => mockPush(...a) } }));
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return { Image: (p) => <View testID="photo" {...p} /> };
});
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const asset = { uri: "file:///leaf.jpg", width: 4000, height: 3000, fileSize: 4_100_000, mimeType: "image/jpeg" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(image, "compressForUpload").mockResolvedValue({ uri: "file:///small.jpg", width: 1280, height: 960 });
  global.fetch = jest.fn(async () => ({ arrayBuffer: async () => ({ byteLength: 205_000 }) }));
});

test("camera workflow: permission, capture, compress, upload, open result", async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset] });
  const up = jest.spyOn(api, "uploadPrediction").mockImplementation(async (_uri, onProgress) => {
    onProgress(0.5);
    return { id: "pred-123" };
  });

  await render(<CheckScreen />);
  await fireEvent.press(screen.getByText("Take photo"));
  expect(await screen.findByText("Check this leaf")).toBeTruthy();
  expect(image.compressForUpload).toHaveBeenCalledWith("file:///leaf.jpg", 4000, 3000);
  expect(screen.getByText("3.9 MB")).toBeTruthy(); // original
  expect(screen.getByText("200 KB · 1280×960")).toBeTruthy(); // sent
  expect(screen.getByText("Retake")).toBeTruthy();

  await fireEvent.press(screen.getByText("Check this leaf"));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/result/pred-123"));
  expect(up).toHaveBeenCalledWith("file:///small.jpg", expect.any(Function), expect.any(Function));
});

test("camera permission denied shows an explanation and no upload", async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  await render(<CheckScreen />);
  await fireEvent.press(screen.getByText("Take photo"));
  expect(await screen.findByText(/Camera permission is needed/)).toBeTruthy();
  expect(screen.getByText("Open settings")).toBeTruthy();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test("gallery workflow and retake", async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
  await render(<CheckScreen />);
  await fireEvent.press(screen.getByText("Choose from gallery"));
  expect(await screen.findByText("Check this leaf")).toBeTruthy();
  await fireEvent.press(screen.getByText("Retake"));
  expect(await screen.findByText("Take photo")).toBeTruthy();
});

test("cancelled picker leaves the screen unchanged", async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  await render(<CheckScreen />);
  await fireEvent.press(screen.getByText("Choose from gallery"));
  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  expect(screen.getByText("Take photo")).toBeTruthy();
  expect(image.compressForUpload).not.toHaveBeenCalled();
});

test("network failure during upload shows the message and retries", async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
  const up = jest
    .spyOn(api, "uploadPrediction")
    .mockRejectedValueOnce(
      new api.ApiError(0, "network", "No connection. Check your mobile data or Wi-Fi and try again."),
    )
    .mockResolvedValueOnce({ id: "pred-9" });
  await render(<CheckScreen />);
  await fireEvent.press(screen.getByText("Choose from gallery"));
  await fireEvent.press(await screen.findByText("Check this leaf"));
  expect(await screen.findByText(/No connection/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Try again"));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/result/pred-9"));
  expect(up).toHaveBeenCalledTimes(2);
});

test("a photo that is not a leaf shows a toast asking for a leaf, with no result", async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
  jest
    .spyOn(api, "uploadPrediction")
    .mockRejectedValueOnce(new api.ApiError(422, "not_a_leaf", "This doesn't look like a leaf."));
  const metrics = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastProvider>
        <CheckScreen />
      </ToastProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(screen.getByText("Choose from gallery"));
  await fireEvent.press(await screen.findByText("Check this leaf"));
  expect(await screen.findByText(/Please upload a photo of a leaf/)).toBeTruthy();
  expect(screen.getByText("Take photo")).toBeTruthy(); // back to the start, ready for another photo
  expect(mockPush).not.toHaveBeenCalled();
});
