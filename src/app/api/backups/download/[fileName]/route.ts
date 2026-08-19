import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, basename } from "node:path";

import { NextResponse } from "next/server";

import { requireOwner } from "@/infrastructure/authorization/rbac";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BACKUP_PACKAGE_PREFIX } from "@/domains/backups/backup-format";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  try {
    const { fileName } = await params;
    const auth = await apiContext(request.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    requireOwner(context);

    if (!fileName.startsWith(BACKUP_PACKAGE_PREFIX) || !fileName.endsWith(".tar.gz") || fileName !== basename(fileName)) {
      return new NextResponse(null, { status: 404 });
    }

    const backupRoot = process.env.WBOS_BACKUP_DIR ?? join(process.cwd(), "backups");
    const filePath = join(backupRoot, "packages", fileName);
    const fileStat = await stat(filePath).catch(() => null);

    if (!fileStat?.isFile()) {
      return new NextResponse(null, { status: 404 });
    }

    const stream = createReadStream(filePath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, { status: 401 });
  }
}
