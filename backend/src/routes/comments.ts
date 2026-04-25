import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router({ mergeParams: true }); // taskId from parent
const prisma = new PrismaClient();

// GET /api/tasks/:taskId/comments
router.get('/', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, name: true, color: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ success: true, data: comments });
});

// POST /api/tasks/:taskId/comments
const CreateSchema = z.object({
  text:     z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { taskId } = req.params;
  const userId = (req as any).user?.id;

  const comment = await prisma.comment.create({
    data: { text: parse.data.text, mentions: parse.data.mentions, taskId, userId },
    include: {
      user: { select: { id: true, name: true, color: true, avatarUrl: true } },
    },
  });

  // Notify mentioned users
  if (parse.data.mentions.length > 0) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true, projectId: true },
    });
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await prisma.notification.createMany({
      data: parse.data.mentions
        .filter((id: string) => id !== userId)
        .map((mentionedId: string) => ({
          userId:  mentionedId,
          type:    'MENTION',
          title:   `${actor?.name ?? 'Alguém'} te mencionou`,
          message: `Em "${task?.title ?? 'task'}": ${parse.data.text.slice(0, 80)}...`,
          link:    `/kanban`,
        })),
      skipDuplicates: true,
    }).catch(() => {}); // Graceful — ignore if Notification model missing
  }

  return res.status(201).json({ success: true, data: comment });
});

// PATCH /api/tasks/:taskId/comments/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const parse = z.object({ text: z.string().min(1).max(5000) }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Texto inválido.' });

  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Comentário não encontrado.' });
  if (existing.userId !== userId) return res.status(403).json({ error: 'Sem permissão.' });

  const updated = await prisma.comment.update({
    where: { id },
    data: { text: parse.data.text },
    include: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
  });
  return res.json({ success: true, data: updated });
});

// DELETE /api/tasks/:taskId/comments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId  = (req as any).user?.id;
  const role    = (req as any).user?.role;

  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Comentário não encontrado.' });
  if (existing.userId !== userId && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão.' });
  }

  await prisma.comment.delete({ where: { id } });
  return res.json({ success: true });
});

export default router;
