import { chromium } from "playwright";

let browser: import("playwright").Browser | null = null;
let browserPromise: Promise<import("playwright").Browser> | null = null;

async function getBrowser() {
  if (browser) return browser;

  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }

  browser = await browserPromise;
  return browser;
}

export async function generatePdfFromUrl(url: string): Promise<Uint8Array> {
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HKL, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const printRootCount = await page.locator(".print-page").count().catch(() => 0);
  if (printRootCount === 0) {
    await context.close();
    throw new Error(
      "Playwright was redirected to /sign-in. The download token may be invalid or expired, " +
        "or the print route may not be properly configured to accept token-based auth.",
    );
  }

  const buffer = await page.pdf({
    format: "A4",
    margin: { top: "12mm", bottom: "12mm", left: "15mm", right: "15mm" },
    printBackground: true,
    preferCSSPageSize: true,
  });

  await context.close();
  return buffer as unknown as Uint8Array;
}

export async function generatePdfFromHtml(html: string): Promise<Uint8Array> {
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const buffer = await page.pdf({
    format: "A4",
    margin: { top: "12mm", bottom: "12mm", left: "15mm", right: "15mm" },
    printBackground: true,
    preferCSSPageSize: true,
  });

  await context.close();
  return buffer as unknown as Uint8Array;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    browserPromise = null;
  }
}
