import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

/**
 * GET /api/search?q=&projectId=
 * Busca global em tasks, documentos e épicos.
 * Se projectId for passado, limita ao projeto.
 * Sem projectId, busca em todos os itens (usuário autenticado = acesso global).
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q, projectId } = req.query as { q?: string; projectId?: string };

    if (!q || q.trim().length < 2) {
      res.json({ success: true, data: { tasks: [], documents: [], epics: [] } });
      return;
    }

    const term = q.trim();

    // Project scope: narrow to a specific project if provided, otherwise global
    const projectScope = projectId ? { projectId } : {};

    const [tasks, documents, epics] = await Promise.all([
      prisma.task.findMany({
        where: {
          title: { contains: term, mode: 'insensitive' },
          ...projectScope,
        },
        select: {
          id: true, taskKey: true, title: true, type: true, priority: true,
          column:   { select: { name: true, color: true } },
          project:  { select: { id: true, name: true, key: true, color: true, iconEmoji: true } },
          epic:     { select: { id: true, title: true, color: true } },
          assignees: {
            select: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
            take: 3,
          },
        },
        take: 15,
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.document.findMany({
        where: {
          title: { contains: term, mode: 'insensitive' },
          ...(projectId ? { projectId } : {}),
        },
        select: {
          id: true, title: true, type: true, updatedAt: true,
          project: { select: { id: true, name: true, color: true, iconEmoji: true } },
          space:   { select: { name: true } },
          author:  { select: { name: true } },
        },
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.epic.findMany({
        where: {
          title: { contains: term, mode: 'insensitive' },
          ...projectScope,
        },
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
  } catch (err: any) {
    console.error('[search] erro:', err?.message ?? err);
    res.status(500).json({ success: false, error: 'Erro interno na busca.', data: { tasks: [], documents: [], epics: [] } });
  }
});

export default router;
