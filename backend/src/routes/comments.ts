import { Router, Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import { z } from 'zod';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// GET /api/tasks/:taskId/comments
router.get('/', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, name: true, color: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ success: true, data: comments });
});

// POST /api/tasks/:taskId/comments
const CreateSchema = z.object({
  content:  z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { taskId } = req.params;
  const authorId = (req as any).user?.id;

  const comment = await prisma.comment.create({
    data: {
      content:  parse.data.content,
      mentions: parse.data.mentions,
      taskId,
      authorId,
    },
    include: {
      author: { select: { id: true, name: true, color: true, avatarUrl: true } },
    },
  });

  // Notify mentioned users
  if (parse.data.mentions.length > 0) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });
    const actor = await prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true },
    });
    await prisma.notification.createMany({
      data: parse.data.mentions
        .filter((id: string) => id !== authorId)
        .map((userId: string) => ({
          userId,
          type:  NotificationType.TASK_COMMENTED,
          title: `${actor?.name ?? 'Alguém'} te mencionou`,
          body:  `Em "${task?.title ?? 'task'}": ${parse.data.content.slice(0, 80)}`,
          link:  '/kanban',
        })),
      skipDuplicates: true,
    }).catch(() => {});
  }

  return res.status(201).json({ success: true, data: comment });
});

// PATCH /api/tasks/:taskId/comments/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authorId = (req as any).user?.id;
  const parse = z.object({ content: z.string().min(1).max(5000) }).safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Conteúdo inválido.' });

  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Comentário não encontrado.' });
  if (existing.authorId !== authorId) return res.status(403).json({ error: 'Sem permissão.' });

  const updated = await prisma.comment.update({
    where: { id },
    data: { content: parse.data.content },
    include: {
      author: { select: { id: true, name: true, color: true, avatarUrl: true } },
    },
  });
  return res.json({ success: true, data: updated });
});

// DELETE /api/tasks/:taskId/comments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id }    = req.params;
  const authorId  = (req as any).user?.id;
  const role      = (req as any).user?.role;

  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Comentário não encontrado.' });
  if (existing.authorId !== authorId && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão.' });
  }

  await prisma.comment.delete({ where: { id } });
  return res.json({ success: true });
});

export default router;
