// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";
import { MAX_IMAGE_BYTES } from "@/lib/server/screenshot";

const suggestions = [
  { text: "A bright little masterpiece!", reason: "The screenshot shows a sunny scene." },
  { text: "This view understood the assignment.", reason: "The scene has a view." },
  { text: "The colors are doing all the talking.", reason: "The post has strong colors." },
];

function providerResult(result: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function upload(bytes: Uint8Array, type = "image/png", caption?: string) {
  const form = new FormData();
  form.append("screenshot", new File([bytes], "post.png", { type }));
  if (caption !== undefined) form.append("caption", caption);
  return new Request("http://localhost/api/generate-comments/image", { method: "POST", body: form });
}

let png: Uint8Array;
beforeEach(async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  vi.stubEnv("OPENROUTER_MODEL", "openrouter/free");
  png = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 3, background: "white" } }).png().toBuffer());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResult({ status: "ok", comments: suggestions })));
});

describe("screenshot generation route", () => {
  it("generates from a screenshot without a caption using the verified image", async () => {
    const response = await POST(upload(png));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.suggestions).toEqual(suggestions);
    expect(body.comments).toContain("Here are 3 comments:");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const providerBody = JSON.parse(String(options?.body));
    expect(providerBody.model).toBe("openrouter/free");
    expect(providerBody.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    expect(providerBody.provider.require_parameters).toBe(true);
  });

  it("uses the supplied full caption, including a correction to truncated screenshot text", async () => {
    const caption = "Full caption: the surprise ending was a pottery class.";
    const response = await POST(upload(png, "image/png", caption));
    expect(response.status).toBe(200);
    const providerBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(providerBody.messages[1].content[0].text).toContain(caption);
    expect(providerBody.messages[0].content).toContain("takes precedence over cropped or truncated screenshot text");
  });

  it("rejects unsupported, corrupt, oversized, and dimensionally oversized images", async () => {
    expect((await POST(upload(png, "application/pdf"))).status).toBe(422);
    const corrupt = await POST(upload(new TextEncoder().encode("not an image")));
    expect(corrupt.status).toBe(422);
    expect((await corrupt.json()).detail).toContain("could not be read");
    const oversized = await POST(upload(new Uint8Array(MAX_IMAGE_BYTES + 1)));
    expect(oversized.status).toBe(413);
    const tooWide = new Uint8Array(await sharp({ create: { width: 25_000, height: 1_001, channels: 3, background: "white" } }).png().toBuffer());
    const dimensions = await POST(upload(tooWide));
    expect(dimensions.status).toBe(422);
    expect((await dimensions.json()).detail).toContain("dimensions");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed forms and captions", async () => {
    const wrongType = new Request("http://localhost/api/generate-comments/image", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect((await POST(wrongType)).status).toBe(415);
    const noFile = new FormData();
    noFile.append("caption", "A caption");
    expect((await POST(new Request("http://localhost/api/generate-comments/image", { method: "POST", body: noFile }))).status).toBe(422);
    expect((await POST(upload(png, "image/png", "x".repeat(2201)))).status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a useful response when the image lacks context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(providerResult({ status: "insufficient_context", comments: [] })));
    const response = await POST(upload(png));
    expect(response.status).toBe(422);
    expect((await response.json()).detail).toContain("clearer image");
  });

  it("handles provider errors and missing configuration without exposing the image", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider error", { status: 503 })));
    const failed = await POST(upload(png));
    expect(failed.status).toBe(503);
    expect((await failed.json()).detail).toContain("AI provider");
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const unconfigured = await POST(upload(png));
    expect(unconfigured.status).toBe(503);
    expect((await unconfigured.json()).detail).toContain("OPENROUTER_API_KEY");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns a clear timeout message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    const response = await POST(upload(png));
    expect(response.status).toBe(503);
    expect((await response.json()).detail).toContain("too long");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
