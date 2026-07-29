export type PushPayload = {
  type: string;
  entityType: string;
  entityId: string;
};

export type PushRecipient = {
  userId: string;
  organizationId: string;
};

export type PushResult = {
  success: boolean;
  token?: string;
  error?: string;
};

export interface PushNotificationProvider {
  send(userId: string, title: string, body: string | undefined, payload: PushPayload): Promise<PushResult>;
}
