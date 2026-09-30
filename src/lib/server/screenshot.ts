import "server-only";

import sharp from "sharp";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4_400_000;
const MAX_IMAGE_PIXELS = 25_000_000;
const FORMAT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export class ScreenshotError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function readBoundedFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new ScreenshotError(415, "Send the screenshot as multipart form data.");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new ScreenshotError(413, "The upload is too large. Choose a screenshot under 4 MiB.");
  }
  if (!request.body) throw new ScreenshotError(422, "Add a screenshot before generating comments.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ScreenshotError(413, "The upload is too large. Choose a screenshot under 4 MiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    }).formData();
  } catch {
    throw new ScreenshotError(422, "The upload could not be read. Choose the screenshot again.");
  }
}

export async function screenshotDataUrl(value: FormDataEntryValue | null): Promise<string> {
  if (!(value instanceof File)) {
    throw new ScreenshotError(422, "Add a screenshot before generating comments.");
  }
  if (!Object.values(FORMAT_TO_MIME).includes(value.type)) {
    throw new ScreenshotError(422, "Choose a PNG, JPEG, or WebP screenshot.");
  }
  if (value.size === 0) throw new ScreenshotError(422, "The screenshot is empty. Choose another image.");
  if (value.size > MAX_IMAGE_BYTES) {
    throw new ScreenshotError(413, "The screenshot is over 4 MiB. Choose a smaller image.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  try {
    const metadata = await sharp(bytes, { limitInputPixels: false, failOn: "error" }).metadata();
    if (!metadata.format || FORMAT_TO_MIME[metadata.format] !== value.type) {
      throw new ScreenshotError(422, "The file contents do not match its PNG, JPEG, or WebP type.");
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw new ScreenshotError(422, "The screenshot is too large in dimensions. Choose a smaller image.");
    }
    await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" }).stats();
    return `data:${value.type};base64,${bytes.toString("base64")}`;
  } catch (error) {
    if (error instanceof ScreenshotError) throw error;
    throw new ScreenshotError(422, "This screenshot could not be read. Choose another image.");
  }
}
