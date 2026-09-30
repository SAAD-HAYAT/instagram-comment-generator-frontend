import { generateComments, generationErrorResponse, responseBody } from "@/lib/server/comment-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ detail: "Send a JSON body with a caption." }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > 16_000) return Response.json({ detail: "The request is too large." }, { status: 413 });

  let data: unknown;
  try {
    if (!request.body) throw new Error("Missing body");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_000) {
          await reader.cancel();
          return Response.json({ detail: "The request is too large." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return Response.json({ detail: "Send a valid JSON body with a caption." }, { status: 422 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return Response.json({ detail: "Send a valid JSON body with a caption." }, { status: 422 });
  }
  const input = data as Record<string, unknown>;
  if (typeof input.caption !== "string" || !input.caption.trim()) {
    return Response.json({ detail: "Provide a caption. URL-only generation is no longer available." }, { status: 422 });
  }
  const caption = input.caption.trim();
  if (caption.length > 2200) {
    return Response.json({ detail: "The caption must be 2,200 characters or fewer." }, { status: 422 });
  }

  try {
    const result = await generateComments(caption);
    if (result.status === "insufficient_context") {
      return Response.json({ detail: "Add more post details to the caption for specific comments." }, { status: 422 });
    }
    return Response.json(responseBody(result.comments));
  } catch (error) {
    return generationErrorResponse(error);
  }
}
