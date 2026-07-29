import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

import type { DevicePlatform } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const body = await req.json();
    const { token, platform, deviceName, appVersion } = body as {
      token: string;
      platform: DevicePlatform;
      deviceName?: string;
      appVersion?: string;
    };

    if (!token || !platform) {
      return NextResponse.json({ error: "token and platform are required" }, { status: 400 });
    }

    if (platform !== "ANDROID" && platform !== "IOS") {
      return NextResponse.json({ error: "platform must be ANDROID or IOS" }, { status: 400 });
    }

    await prisma.deviceToken.upsert({
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const body = await req.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    await prisma.deviceToken.updateMany({
      where: { userId: context.userId, token },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
