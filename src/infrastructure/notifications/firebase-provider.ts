import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { prisma } from "@/infrastructure/database/prisma";
import type { PushNotificationProvider, PushPayload, PushResult } from "./push-notification-provider";

function getPrivateKey(): string {
  const env = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (env) return env.replace(/\\n/g, "\n");
  const path = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (path) {
    try {
      const fs = require("fs") as typeof import("fs");
      const json = JSON.parse(fs.readFileSync(path, "utf-8"));
      return json.private_key;
    } catch {
      throw new Error("FIREBASE_ADMIN_PRIVATE_KEY not set and FIREBASE_ADMIN_KEY_PATH could not be read");
    }
  }
  throw new Error("FIREBASE_ADMIN_PRIVATE_KEY or FIREBASE_ADMIN_KEY_PATH env var must be set");
}

function getClientEmail(): string {
  const env = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  if (env) return env;
  const path = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (path) {
    try {
      const fs = require("fs") as typeof import("fs");
      const json = JSON.parse(fs.readFileSync(path, "utf-8"));
      return json.client_email;
    } catch {
      throw new Error("FIREBASE_ADMIN_CLIENT_EMAIL not set and FIREBASE_ADMIN_KEY_PATH could not be read");
    }
  }
  throw new Error("FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_KEY_PATH env var must be set");
}

function getProjectId(): string {
  const env = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (env) return env;
  const path = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (path) {
    try {
      const fs = require("fs") as typeof import("fs");
      const json = JSON.parse(fs.readFileSync(path, "utf-8"));
      return json.project_id;
    } catch {
      throw new Error("FIREBASE_ADMIN_PROJECT_ID not set and FIREBASE_ADMIN_KEY_PATH could not be read");
    }
  }
  throw new Error("FIREBASE_ADMIN_PROJECT_ID or FIREBASE_ADMIN_KEY_PATH env var must be set");
}

function ensureApp() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: getProjectId(),
        clientEmail: getClientEmail(),
        privateKey: getPrivateKey(),
      }),
    });
  }
}

export class FirebaseProvider implements PushNotificationProvider {
  async send(userId: string, title: string, body: string | undefined, payload: PushPayload): Promise<PushResult> {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) return { success: true };

    ensureApp();

    const baseMessage: Omit<Message, "token"> = {
      notification: { title, body: body ?? undefined },
      data: {
        type: payload.type,
        entityType: payload.entityType,
        entityId: payload.entityId,
      },
      android: {
        notification: {
          channelId: "default",
          priority: "high",
        },
      },
    };

    let lastResult: PushResult = { success: true };

    for (const t of tokens) {
      const msg = { ...baseMessage, token: t.token };
      try {
        await getMessaging().send(msg);
        lastResult = { success: true, token: t.token };
      } catch (err: unknown) {
        const fbErr = err as { code?: string; message?: string };
        if (fbErr.code === "messaging/registration-token-not-registered" || fbErr.code === "messaging/invalid-argument") {
          await prisma.deviceToken.update({
            where: { id: t.id },
            data: { isActive: false },
          });
          lastResult = { success: false, token: t.token, error: fbErr.code };
        } else {
          lastResult = { success: false, token: t.token, error: fbErr.message ?? "unknown error" };
        }
      }
    }

    return lastResult;
  }
}
