import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

import type { DevicePlatform } from "@prisma/client";

function maskToken(token: string): string {
  if (token.length <= 12) return `${token.length} chars`;
  return `${token.slice(0, 8)}...${token.slice(-4)} (${token.length} chars)`;
}

export async function POST(req: NextRequest) {
  let context;
  try {
    context = await new AuthenticatedRequestContextService().getCurrentContext();
  } catch (err) {
    console.warn("[device-tokens] POST rejected: authentication failed", (err as Error).message ?? err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { token, platform, deviceName, appVersion } = (body ?? {}) as {
    token?: string;
    platform?: DevicePlatform;
    deviceName?: string;
    appVersion?: string;
  };

  if (!token || !platform) {
    console.warn(
      `[device-tokens] POST validation failed (userId=${context.userId}): token=${Boolean(token)}, platform=${String(platform)}`,
    );
    return NextResponse.json({ error: "token and platform are required" }, { status: 400 });
  }

  if (platform !== "ANDROID" && platform !== "IOS") {
    console.warn(`[device-tokens] POST invalid platform (userId=${context.userId}): ${String(platform)}`);
    return NextResponse.json({ error: "platform must be ANDROID or IOS" }, { status: 400 });
  }

  console.info(
    `[device-tokens] POST register (userId=${context.userId}, platform=${platform}, device=${deviceName ?? "unknown"}, appVersion=${appVersion ?? "unknown"}, token=${maskToken(token)})`,
  );

  try {
    const row = await prisma.deviceToken.upsert({
      where: { userId_token: { userId: context.userId, token } },
      create: {
        userId: context.userId,
        token,
        platform,
        deviceName: deviceName ?? null,
        appVersion: appVersion ?? null,
      },
      update: {
        platform,
        deviceName: deviceName ?? null,
        appVersion: appVersion ?? null,
        lastSeenAt: new Date(),
        isActive: true,
      },
    });

    console.info(`[device-tokens] POST upserted device token (userId=${context.userId}, id=${row.id}, isActive=${row.isActive})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[device-tokens] POST upsert failed (userId=${context.userId})`, err);
    return NextResponse.json({ error: "Failed to register device token" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let context;
  try {
    context = await new AuthenticatedRequestContextService().getCurrentContext();
  } catch (err) {
    console.warn("[device-tokens] DELETE rejected: authentication failed", (err as Error).message ?? err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { token } = (body ?? {}) as { token?: string };

  if (!token) {
    console.warn(`[device-tokens] DELETE missing token (userId=${context.userId})`);
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  console.info(`[device-tokens] DELETE deactivate (userId=${context.userId}, token=${maskToken(token)})`);

  try {
    const result = await prisma.deviceToken.updateMany({
      where: { userId: context.userId, token },
      data: { isActive: false },
    });
    console.info(`[device-tokens] DELETE deactivated ${result.count} token(s) (userId=${context.userId})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[device-tokens] DELETE failed (userId=${context.userId})`, err);
    return NextResponse.json({ error: "Failed to deactivate device token" }, { status: 500 });
  }
}
