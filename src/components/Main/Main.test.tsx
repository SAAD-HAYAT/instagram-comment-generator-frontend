import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Main from "./Main";


const suggestions = [
  { text: "A sunny masterpiece!", reason: "The post shows sunlight." },
  { text: "That color palette deserves applause.", reason: "The image is colorful." },
  { text: "This view just won the day.", reason: "The scene has a view." },
];

function screenshot(name = "post.png", type = "image/png") {
  return new File(["image bytes"], name, { type });
}

function selectFile(file: File) {
  fireEvent.change(screen.getByTestId("screenshot-input"), { target: { files: [file] } });
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions, comments: "legacy" }) }),
  );
});

describe("screenshot input", () => {
  it("selects, previews, replaces, and removes a screenshot", async () => {
    render(<Main />);
    const generate = screen.getByRole("button", { name: "Generate 3 witty comments" });
    expect(generate).toBeDisabled();

    selectFile(screenshot("first.png"));
    expect(await screen.findByAltText("Selected Instagram post screenshot preview")).toBeInTheDocument();
    expect(screen.getByText("first.png")).toBeInTheDocument();
    expect(generate).toBeEnabled();

    selectFile(screenshot("second.png"));
    expect(screen.getByText("second.png")).toBeInTheDocument();
    expect(screen.queryByText("first.png")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByAltText("Selected Instagram post screenshot preview")).not.toBeInTheDocument();
    expect(generate).toBeDisabled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("accepts a dropped screenshot", async () => {
    render(<Main />);
    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files: [screenshot("dropped.png")] },
    });
    expect(await screen.findByText("dropped.png")).toBeInTheDocument();
  });

  it("accepts a pasted screenshot", async () => {
    render(<Main />);
    fireEvent.paste(document, {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => screenshot("pasted.png") }],
      },
    });
    expect(await screen.findByText("pasted.png")).toBeInTheDocument();
  });

  it("rejects unsupported and oversized files", () => {
    render(<Main />);
    selectFile(screenshot("document.pdf", "application/pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent("PNG, JPEG, or WebP");

    const huge = screenshot("large.png");
    Object.defineProperty(huge, "size", { value: 4 * 1024 * 1024 + 1 });
    selectFile(huge);
    expect(screen.getByRole("alert")).toHaveTextContent("over 4 MiB");
    expect(screen.getByRole("button", { name: "Generate 3 witty comments" })).toBeDisabled();
  });
});

describe("generation", () => {
  it("submits the corrected caption with the screenshot and copies one suggestion", async () => {
    render(<Main />);
    selectFile(screenshot());
    fireEvent.change(screen.getByLabelText(/Full caption/), {
      target: { value: "The full ending that the screenshot cuts off." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 witty comments" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/generate-comments/image");
    expect(options?.method).toBe("POST");
    const form = options?.body as FormData;
    expect(form.get("caption")).toBe("The full ending that the screenshot cuts off.");
    expect((form.get("screenshot") as File).name).toBe("post.png");

    expect(await screen.findByText("A sunny masterpiece!")).toBeInTheDocument();
    const copyButtons = screen.getAllByRole("button", { name: "Copy comment" });
    expect(copyButtons).toHaveLength(3);
    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("A sunny masterpiece!"));
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("shows an actionable model failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "OpenRouter could not generate comments right now." }),
      }),
    );
    render(<Main />);
    selectFile(screenshot());
    fireEvent.click(screen.getByRole("button", { name: "Generate 3 witty comments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OpenRouter could not generate comments right now.");
  });
});
