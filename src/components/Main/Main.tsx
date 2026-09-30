"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

type Suggestion = { text: string; reason: string };
type GenerationResponse = { suggestions: Suggestion[]; comments: string };

function errorDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  return typeof body.detail === "string" ? body.detail : null;
}

export default function Main() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const chooseFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Choose a PNG, JPEG, or WebP screenshot.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("The screenshot is over 8 MiB. Choose a smaller image.");
      return;
    }
    if (file.size === 0) {
      setError("The screenshot is empty. Choose another image.");
      return;
    }
    setScreenshot(file);
    setSuggestions([]);
    setCopiedIndex(null);
    setError(null);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isLoading) return;
      const image = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"));
      const file = image?.getAsFile();
      if (file) {
        event.preventDefault();
        chooseFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [chooseFile, isLoading]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) chooseFile(event.dataTransfer.files[0]);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setSuggestions([]);
    setCopiedIndex(null);
    setError(null);
  };

  const onPreviewError = () => {
    setScreenshot(null);
    setSuggestions([]);
    setError("This screenshot could not be read. Choose another image.");
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!screenshot || isLoading) return;
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setCopiedIndex(null);

    const form = new FormData();
    form.append("screenshot", screenshot, screenshot.name || "screenshot.png");
    form.append("caption", caption.trim());

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-comments/image`, {
        method: "POST",
        body: form,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorDetail(body) || "Comments could not be generated. Please try again.");
      }
      const result = body as GenerationResponse | null;
      if (
        !result ||
        !Array.isArray(result.suggestions) ||
        result.suggestions.length !== 3 ||
        result.suggestions.some((item) => typeof item.text !== "string" || typeof item.reason !== "string")
      ) {
        throw new Error("The server returned an unexpected response. Please try again.");
      }
      setSuggestions(result.suggestions);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Could not reach the comment service. Check your connection and try again."
          : cause instanceof Error
            ? cause.message
            : "Comments could not be generated. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyComment = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setError(null);
    } catch {
      setError("Could not copy the comment. Select and copy it manually.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-instagram-yellow via-instagram-pink to-instagram-blue px-4 py-8 text-[#000] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em]">Instagram Comment Generator</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Better comments start with the post.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            Add a screenshot, fill in the caption if it is cut off, and get three witty comments you can copy.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <form onSubmit={generate} className="rounded-3xl bg-white p-5 shadow-xl shadow-[#525789]/10 sm:p-8" aria-busy={isLoading}>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#525789] text-sm font-bold text-white">1</span>
              <div>
                <h2 className="text-xl font-bold">Add the post screenshot</h2>
                <p className="text-sm text-[#59617d]">No Instagram login or post link needed.</p>
              </div>
            </div>

            <input
              ref={inputRef}
              id="screenshot-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
              className="hidden"
              aria-label="Instagram post screenshot"
              data-testid="screenshot-input"
            />

            <div
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${
                isDragging ? "border-[#525789] bg-[#e9edfc]" : "border-[#9da5ce] bg-[#f7f8ff]"
              }`}
              data-testid="drop-zone"
            >
              {previewUrl ? (
                <div>
                  {/* A blob URL is created only for the local preview. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected Instagram post screenshot preview"
                    onError={onPreviewError}
                    className="mx-auto max-h-[420px] max-w-full rounded-xl border border-[#d6daf0] object-contain"
                  />
                  <p className="mt-3 break-all text-sm text-[#59617d]">{screenshot?.name || "Pasted screenshot"}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={isLoading} className="rounded-lg border border-[#525789] px-4 py-2 font-semibold text-[#525789] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789] disabled:opacity-50">
                      Replace screenshot
                    </button>
                    <button type="button" onClick={removeScreenshot} disabled={isLoading} className="rounded-lg px-4 py-2 font-semibold text-[#525789] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789] disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-7">
                  <div aria-hidden="true" className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">▣</div>
                  <p className="font-semibold">Drop a screenshot here</p>
                  <p className="mt-1 text-sm text-[#59617d]">or paste one from your clipboard</p>
                  <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-xl bg-[#525789] px-6 py-3 font-semibold text-white hover:bg-[#41466f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789]">
                    Choose screenshot
                  </button>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-[#59617d]">PNG, JPEG, or WebP · up to 8 MiB · one image at a time</p>

            <div className="mt-8">
              <label htmlFor="caption" className="text-base font-bold">Full caption <span className="font-normal text-[#59617d]">(optional)</span></label>
              <p id="caption-hint" className="mt-1 text-sm text-[#59617d]">Add or correct text that is cut off in the screenshot.</p>
              <textarea
                id="caption"
                aria-describedby="caption-hint"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={4}
                placeholder="Paste the full post caption here if you have it..."
                className="mt-3 w-full resize-y rounded-xl border border-[#adb4d4] bg-white p-3 text-[#30365d] placeholder:text-[#858ca8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789]"
              />
            </div>

            <button type="submit" disabled={!screenshot || isLoading} className="mt-6 w-full rounded-xl bg-[#525789] px-6 py-3.5 text-base font-bold text-white hover:bg-[#41466f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789] disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? "Reading your screenshot..." : "Generate 3 witty comments"}
            </button>
            <p className="mt-3 text-center text-xs text-[#59617d]">Your screenshot is sent to the AI provider for this request. This app does not save or post it.</p>
          </form>

          <section className="rounded-3xl bg-white p-5 shadow-xl shadow-[#525789]/10 sm:p-8" aria-labelledby="results-heading">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#525789] text-sm font-bold text-white">2</span>
              <h2 id="results-heading" className="text-xl font-bold">Your comments</h2>
            </div>

            <div role="status" aria-live="polite" className="sr-only">
              {isLoading ? "Generating comments" : suggestions.length ? "Three comments ready to copy" : ""}
            </div>
            {error && <div role="alert" className="mb-5 rounded-xl border border-[#e6a2a8] bg-[#fff1f2] p-4 text-sm text-[#9c2736]">{error}</div>}

            {suggestions.length ? (
              <ol className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <li key={`${suggestion.text}-${index}`} className="rounded-2xl border border-[#d9def0] bg-[#f7f8ff] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0e5f8] text-sm font-bold text-[#525789]">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-lg font-semibold leading-snug">{suggestion.text}</p>
                        <p className="mt-2 text-sm text-[#59617d]">{suggestion.reason}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => copyComment(suggestion.text, index)} className="mt-4 rounded-lg border border-[#525789] px-4 py-2 text-sm font-semibold text-[#525789] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#525789]">
                      {copiedIndex === index ? "Copied!" : "Copy comment"}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9def0] bg-[#f7f8ff] p-7 text-center">
                <p className="text-lg font-semibold">{isLoading ? "Finding the best details..." : "Your ideas will appear here"}</p>
                <p className="mt-2 max-w-xs text-sm text-[#59617d]">{isLoading ? "This may take a moment." : "Add a screenshot to get comments grounded in the post."}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
