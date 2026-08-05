import { FirebaseProvider } from "@/infrastructure/notifications";
import { NotificationService } from "@/domains/notifications/services/notification-service";

let firebaseProvider: FirebaseProvider | null = null;
let warnLogged = false;

function getFirebaseProvider(): FirebaseProvider | undefined {
  const hasInlineEnv =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PROJECT_ID;
  const hasKeyPath = process.env.FIREBASE_ADMIN_KEY_PATH;

  if (hasInlineEnv || hasKeyPath) {
    if (!firebaseProvider) {
      firebaseProvider = new FirebaseProvider();
      console.info(`[push] Provider selected: FirebaseProvider (${hasInlineEnv ? "inline env" : "key path"})`);
    }
    return firebaseProvider;
  }

  if (!warnLogged) {
    warnLogged = true;
    console.warn(
      "[push] Push provider NOT configured — notifications are in-app only. " +
        "Set FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PROJECT_ID, or FIREBASE_ADMIN_KEY_PATH.",
    );
  }
  return undefined;
}

export function createNotificationService(): NotificationService {
  return new NotificationService(undefined, getFirebaseProvider());
}
