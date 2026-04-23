import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

/**
 * GET /api/search?q=&projectId=
 * Busca global em tasks e documentos. Se projectId for passado,
 * limita ao projeto. Sem projectId, busca em todos os projetos do usuário.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const { q, projectId } = req.query as { q?: string; projectId?: string };

  if (!q || q.trim().length < 2) {
    res.json({ success: true, data: { tasks: [], documents: [], epics: [] } });
    return;
  }

  const term = q.trim();

  const userProjectFilter = {
    OR: [
      { ownerId: req.user!.userId },
      { members: { some: { userId: req.user!.userId } } },
    ],
  };

  const taskWhere = {
    title: { contains: term, mode: 'insensitive' as const },
    project: projectId ? { id: projectId } : userProjectFilter,
  };

  const docWhere = {
    title: { contains: term, mode: 'insensitive' as const },
    project: projectId ? { id: projectId } : userProjectFilter,
  };

  const epicWhere = {
    title: { contains: term, mode: 'insensitive' as const },
    ...(projectId ? { projectId } : { project: userProjectFilter }),
  };

  const [tasks, documents, epics] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true, taskKey: true, title: true, type: true, priority: true,
        column: { select: { name: true, color: true } },
        project: { select: { id: true, name: true, key: true, color: true, iconEmoji: true } },
        epic: { select: { id: true, title: true, color: true } },
        assignees: {
          select: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
          take: 3,
        },
      },
      take: 15,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.document.findMany({
      where: docWhere,
      select: {
        id: true, title: true, type: true, updatedAt: true,
        project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        space: { select: { name: true } },
        author: { select: { name: true } },
      },
      take: 8,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.epic.findMany({
      where: epicWhere,
      select: {
        id: true, title: true, color: true,
        project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        _count: { select: { tasks: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({ success: true, data: { tasks, documents, epics } });
});

export default router;
