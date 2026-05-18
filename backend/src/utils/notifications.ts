import { prisma } from '../lib/prisma';


export interface NotificationPayload {
  userId:    string;
  type:      'TASK_ASSIGNED' | 'TASK_COMMENTED' | 'TASK_STATUS_CHANGED' | 'SPRINT_STARTED' | 'SPRINT_COMPLETED';
  title:     string;
  body?:     string;
  link?:     string;
  actorId?:  string;
  taskId?:   string;
  projectId?:string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    if (payload.actorId && payload.actorId === payload.userId) return;
    await prisma.notification.create({ data: payload });
  } catch {
    // Notifications are non-fatal
  }
}

export async function createNotificationsForUsers(
  userIds: string[],
  payload: Omit<NotificationPayload, 'userId'>,
): Promise<void> {
  await Promise.all(
    userIds
      .filter(uid => uid !== payload.actorId)
      .map(uid => createNotification({ ...payload, userId: uid }))
  );
}
