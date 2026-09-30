import { generateComments, generationErrorResponse, responseBody } from "@/lib/server/comment-generation";
import { readBoundedFormData, ScreenshotError, screenshotDataUrl } from "@/lib/server/screenshot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await readBoundedFormData(request);
    if (form.getAll("screenshot").length !== 1 || form.getAll("caption").length > 1) {
      throw new ScreenshotError(422, "Send one screenshot and, optionally, one caption.");
    }
    const captionValue = form.get("caption");
    if (captionValue !== null && typeof captionValue !== "string") {
      throw new ScreenshotError(422, "The caption must be text.");
    }
    const caption = (captionValue || "").trim();
    if (caption.length > 2200) throw new ScreenshotError(422, "The caption must be 2,200 characters or fewer.");
    const imageDataUrl = await screenshotDataUrl(form.get("screenshot"));
    const result = await generateComments(caption, imageDataUrl);
    if (result.status === "insufficient_context") {
      throw new ScreenshotError(422, "The screenshot is too unclear for specific comments. Try a clearer image or add the full caption.");
    }
    return Response.json(responseBody(result.comments));
  } catch (error) {
    if (error instanceof ScreenshotError) return Response.json({ detail: error.message }, { status: error.status });
    return generationErrorResponse(error);
  }
}
