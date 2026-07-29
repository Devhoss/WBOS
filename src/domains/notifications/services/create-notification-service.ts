import { FirebaseProvider } from "@/infrastructure/notifications";
import { NotificationService } from "@/domains/notifications/services/notification-service";

let firebaseProvider: FirebaseProvider | null = null;

function getFirebaseProvider(): FirebaseProvider | undefined {
  if (
    (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PROJECT_ID) ||
    process.env.FIREBASE_ADMIN_KEY_PATH
  ) {
    if (!firebaseProvider) {
      firebaseProvider = new FirebaseProvider();
    }
    return firebaseProvider;
  }
  return undefined;
}

export function createNotificationService(): NotificationService {
  return new NotificationService(undefined, getFirebaseProvider());
}
