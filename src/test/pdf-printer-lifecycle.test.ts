import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * REGRESSION — audit finding M2.
 *
 * `generatePdfFromUrl` / `generatePdfFromHtml` closed their Playwright browser
 * context on the success path only. Every failure — a navigation timeout, a
 * sign-in redirect, a PDF render error — leaked a live context against a
 * long-lived shared browser. Contexts are not cheap: each keeps its own
 * renderer processes and memory alive, so a run of failing PDF requests
 * exhausted the host rather than just returning errors.
 *
 * PDF generation is exactly the code path most likely to fail (it depends on
 * an HTTP round trip and a token), which is what made the leak reachable.
 */

const contexts: Array<{ closed: boolean; pdfShouldThrow: boolean; hasPrintRoot: boolean }> = [];
let launchShouldThrow = false;
let connected = true;

function makeContext() {
  const record = { closed: false, pdfShouldThrow: false, hasPrintRoot: true };
  contexts.push(record);

  const page = {
    goto: vi.fn(async () => {}),
    setContent: vi.fn(async () => {}),
    waitForLoadState: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    locator: vi.fn(() => ({ count: async () => (record.hasPrintRoot ? 1 : 0) })),
    pdf: vi.fn(async () => {
      if (record.pdfShouldThrow) throw new Error("render failed");
      return Buffer.from("PDF");
    }),
  };

  return {
    record,
    context: {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => {
        record.closed = true;
      }),
    },
  };
}

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      if (launchShouldThrow) throw new Error("chromium unavailable");
      return {
        isConnected: () => connected,
        newContext: vi.fn(async () => makeContext().context),
        close: vi.fn(async () => {}),
      };
    }),
  },
}));

async function loadPrinter() {
  vi.resetModules();
  contexts.length = 0;
  launchShouldThrow = false;
  connected = true;
  return import("@/lib/pdf/printer");
}

describe("PDF browser-context lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes the context on the success path", async () => {
    const { generatePdfFromUrl } = await loadPrinter();

    await generatePdfFromUrl("http://localhost/print");

    expect(contexts).toHaveLength(1);
    expect(contexts[0].closed).toBe(true);
  });

  it("closes the context when PDF rendering throws", async () => {
    const printer = await loadPrinter();

    // Arrange the failure by patching the next context as it is created.
    const original = contexts.push.bind(contexts);
    contexts.push = ((record: (typeof contexts)[number]) => {
      record.pdfShouldThrow = true;
      return original(record);
    }) as typeof contexts.push;

    await expect(printer.generatePdfFromUrl("http://localhost/print")).rejects.toThrow(
      "render failed",
    );

    contexts.push = original;
    expect(contexts).toHaveLength(1);
    expect(contexts[0].closed).toBe(true);
  });

  it("closes the context when the page is redirected to sign-in", async () => {
    const printer = await loadPrinter();

    const original = contexts.push.bind(contexts);
    contexts.push = ((record: (typeof contexts)[number]) => {
      record.hasPrintRoot = false;
      return original(record);
    }) as typeof contexts.push;

    await expect(printer.generatePdfFromUrl("http://localhost/print")).rejects.toThrow(
      /redirected to \/sign-in/,
    );

    contexts.push = original;
    expect(contexts[0].closed).toBe(true);
  });

  it("closes the context when HTML rendering throws", async () => {
    const printer = await loadPrinter();

    const original = contexts.push.bind(contexts);
    contexts.push = ((record: (typeof contexts)[number]) => {
      record.pdfShouldThrow = true;
      return original(record);
    }) as typeof contexts.push;

    await expect(printer.generatePdfFromHtml("<p>hi</p>")).rejects.toThrow("render failed");

    contexts.push = original;
    expect(contexts[0].closed).toBe(true);
  });

  it("leaks nothing across a run of consecutive failures", async () => {
    const printer = await loadPrinter();

    const original = contexts.push.bind(contexts);
    contexts.push = ((record: (typeof contexts)[number]) => {
      record.pdfShouldThrow = true;
      return original(record);
    }) as typeof contexts.push;

    for (let i = 0; i < 5; i++) {
      await expect(printer.generatePdfFromHtml("<p>hi</p>")).rejects.toThrow();
    }

    contexts.push = original;
    expect(contexts).toHaveLength(5);
    expect(contexts.every((c) => c.closed)).toBe(true);
  });

  it("does not cache a failed browser launch forever", async () => {
    // A rejected launch promise stayed cached, so one transient failure broke
    // every later PDF until the process restarted.
    const printer = await loadPrinter();
    launchShouldThrow = true;

    await expect(printer.generatePdfFromHtml("<p>hi</p>")).rejects.toThrow("chromium unavailable");

    launchShouldThrow = false;
    await expect(printer.generatePdfFromHtml("<p>hi</p>")).resolves.toBeDefined();
  });

  it("relaunches a browser that has crashed rather than reusing it", async () => {
    const printer = await loadPrinter();

    await printer.generatePdfFromHtml("<p>hi</p>");
    connected = false;

    await expect(printer.generatePdfFromHtml("<p>hi</p>")).resolves.toBeDefined();
    expect(contexts).toHaveLength(2);
  });
});
