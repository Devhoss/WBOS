import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { NextResponse } from "next/server";

const STORAGE_ROOT =
  process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "public");

const FALLBACK_ROOT = join(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  if (!path || path.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const safePath = path.join("/").replace(/\.\.\//g, "").replace(/\.\./g, "");

  const candidates = [
    join(STORAGE_ROOT, "uploads", safePath),
    join(STORAGE_ROOT, safePath),
  ];
  if (FALLBACK_ROOT !== STORAGE_ROOT) {
    candidates.push(join(FALLBACK_ROOT, "uploads", safePath));
    candidates.push(join(FALLBACK_ROOT, safePath));
  }

  let filePath: string | null = null;
  for (const c of candidates) {
    if (existsSync(c)) {
      filePath = c;
      break;
    }
  }

  if (!filePath) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
