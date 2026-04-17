import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

const EpicSchema = z.object({
  title:       z.string().min(1).max(300),
  description: z.string().optional(),
  color:       z.string().default('#6366f1'),
  startDate:   z.string().optional(),
  dueDate:     z.string().optional(),
  projectId:   z.string().uuid(),
});

// GET /api/epics?projectId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query as { projectId: string };
  const epics = await prisma.epic.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { column: { select: { isDefault: true } } } },
    },
  });
  const data = epics.map(e => ({
    ...e,
    totalTasks:     e.tasks.length,
    completedTasks: e.tasks.filter(t => t.column?.isDefault).length,
    progress: e.tasks.length ? Math.round((e.tasks.filter(t => t.column?.isDefault).length / e.tasks.length) * 100) : 0,
  }));
  res.json({ success: true, data });
});

// POST /api/epics
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = EpicSchema.parse(req.body);
    const epic = await prisma.epic.create({
      data: {
        title: body.title, description: body.description, color: body.color,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        dueDate:   body.dueDate   ? new Date(body.dueDate)   : undefined,
        projectId: body.projectId, creatorId: req.user!.userId,
      },
    });
    res.status(201).json({ success: true, data: epic });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// PATCH /api/epics/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { title, description, color, startDate, dueDate } = req.body;
  const epic = await prisma.epic.update({
    where: { id: req.params.id },
    data: {
      ...(title       !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(color       !== undefined && { color }),
      ...(startDate   !== undefined && { startDate: new Date(startDate) }),
      ...(dueDate     !== undefined && { dueDate:   new Date(dueDate) }),
    },
  });
  res.json({ success: true, data: epic });
});

// DELETE /api/epics/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.task.updateMany({ where: { epicId: req.params.id }, data: { epicId: null } });
  await prisma.epic.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
