import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// GET /api/tasks/:taskId/time-logs
router.get('/', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const logs = await prisma.timeLog.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { date: 'desc' },
  });
  const totalMinutes = logs.reduce((s: number, l: any) => s + l.minutes, 0);
  return res.json({ success: true, data: { logs, totalMinutes } });
});

// POST /api/tasks/:taskId/time-logs
const CreateSchema = z.object({
  minutes: z.number().int().min(1).max(60 * 24),
  note:    z.string().max(500).optional(),
  date:    z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parse = CreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { taskId } = req.params;
  const userId = (req as any).user?.id;

  const log = await prisma.timeLog.create({
    data: {
      taskId,
      userId,
      minutes: parse.data.minutes,
      note: parse.data.note,
      date: parse.data.date ? new Date(parse.data.date) : new Date(),
    },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return res.status(201).json({ success: true, data: log });
});

// DELETE /api/tasks/:taskId/time-logs/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const role   = (req as any).user?.role;

  const log = await prisma.timeLog.findUnique({ where: { id } });
  if (!log) return res.status(404).json({ error: 'Log não encontrado.' });
  if (log.userId !== userId && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  await prisma.timeLog.delete({ where: { id } });
  return res.json({ success: true });
});

// ── GET /api/time-logs/report?projectId=&sprintId=&userId=&from=&to= ──────────
export const timeReportRouter = Router();
timeReportRouter.get('/report', async (req: Request, res: Response) => {
  const { projectId, userId, from, to } = req.query as Record<string, string>;

  const whereClause: any = {};
  if (userId) whereClause.userId = userId;
  if (from || to) {
    whereClause.date = {};
    if (from) whereClause.date.gte = new Date(from);
    if (to)   whereClause.date.lte = new Date(to + 'T23:59:59Z');
  }
  if (projectId) {
    whereClause.task = { projectId };
  }

  const logs = await prisma.timeLog.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true, projectId: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Group by user
  const byUser: Record<string, { user: any; totalMinutes: number; logs: any[] }> = {};
  for (const log of logs) {
    const key = log.userId;
    if (!byUser[key]) byUser[key] = { user: log.user, totalMinutes: 0, logs: [] };
    byUser[key].totalMinutes += log.minutes;
    byUser[key].logs.push({ ...log, user: undefined });
  }

  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  return res.json({ success: true, data: { byUser: Object.values(byUser), totalMinutes, logs } });
});

export default router;
