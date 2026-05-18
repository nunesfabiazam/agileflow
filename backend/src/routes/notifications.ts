import { prisma } from '../lib/prisma';
import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

const notifInclude = {
  actor: { select: { id: true, name: true, color: true, avatarUrl: true } },
  task:  { select: { id: true, taskKey: true, title: true } },
};

// GET /api/notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  const { limit = '30', unreadOnly } = req.query as Record<string, string>;
  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user!.userId,
      ...(unreadOnly === 'true' ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
    include: notifInclude,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.userId, isRead: false },
  });
  res.json({ success: true, data: notifications, unreadCount });
});

// PATCH /api/notifications/read-all  (must come BEFORE /:id routes)
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, isRead: false },
    data:  { isRead: true },
  });
  res.json({ success: true });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.userId },
    data:  { isRead: true },
  });
  res.json({ success: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  res.json({ success: true });
});

export default router;
