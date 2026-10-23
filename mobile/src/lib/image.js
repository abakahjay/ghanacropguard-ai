import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.82;

/**
 * Shrink a camera/gallery photo before upload to save mobile data: longest side 1280 px, JPEG.
 * A 12 MP phone photo (~4 MB) typically becomes ~150-300 KB.
 */
export async function compressForUpload(uri, width, height) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    if (width >= height) ctx.resize({ width: MAX_SIDE, height: null });
    else ctx.resize({ width: null, height: MAX_SIDE });
  }
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: out.uri, width: out.width, height: out.height };
}

export function formatBytes(n) {
  if (!n || n < 1024) return "–"; // a real photo is never this small: the size is unknown
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
