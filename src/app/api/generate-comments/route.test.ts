// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ status: "ok", comments: [
      { text: "One", reason: "Reason one" },
      { text: "Two", reason: "Reason two" },
      { text: "Three", reason: "Reason three" },
    ] }) } }],
  }), { status: 200 })));
});

it("keeps caption-only JSON generation without calling Instagram", async () => {
  const request = new Request("http://localhost/api/generate-comments", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ caption: "A photo of the mountain at dawn." }),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect((await response.json()).suggestions).toHaveLength(3);
  const providerBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
  expect(providerBody.messages[1].content).toHaveLength(1);
});

it("rejects URL-only input with a clear message", async () => {
  const request = new Request("http://localhost/api/generate-comments", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ post_url: "https://instagram.com/p/abc/" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(422);
  expect((await response.json()).detail).toContain("URL-only");
  expect(fetch).not.toHaveBeenCalled();
});
