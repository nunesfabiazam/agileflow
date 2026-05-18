import { prisma } from '../lib/prisma';
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

const SprintSchema = z.object({
  name:      z.string().min(1),
  goal:      z.string().optional(),
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  projectId: z.string().uuid(),
});

// GET /api/sprints?projectId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query as { projectId: string };
  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { storyPoints: true, column: { select: { isDefault: true } } } },
    },
  });
  const data = sprints.map(s => ({
    ...s,
    totalPoints:     s.tasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0),
    completedPoints: s.tasks.filter(t => t.column?.isDefault).reduce((acc, t) => acc + (t.storyPoints ?? 0), 0),
  }));
  res.json({ success: true, data });
});

// POST /api/sprints
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = SprintSchema.parse(req.body);
    const sprint = await prisma.sprint.create({
      data: {
        name: body.name,
        goal: body.goal,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate:   body.endDate   ? new Date(body.endDate)   : undefined,
        projectId: body.projectId,
      },
    });
    res.status(201).json({ success: true, data: sprint });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// PATCH /api/sprints/:id — rename, update dates, change status
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { name, goal, startDate, endDate, status } = req.body;
  const sprint = await prisma.sprint.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(goal !== undefined && { goal }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate   && { endDate:   new Date(endDate)   }),
      ...(status    && { status }),
    },
  });
  res.json({ success: true, data: sprint });
});

// POST /api/sprints/:id/start
router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  // Ensure no other sprint is ACTIVE in the same project
  const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
  if (!sprint) { res.status(404).json({ success: false, error: 'Sprint não encontrada.' }); return; }
  await prisma.sprint.updateMany({
    where: { projectId: sprint.projectId, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  });
  const updated = await prisma.sprint.update({
    where: { id: req.params.id },
    data: { status: 'ACTIVE', startDate: sprint.startDate ?? new Date() },
  });
  res.json({ success: true, data: updated });
});

// POST /api/sprints/:id/complete
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  const { moveToSprintId } = req.body; // ID of the next sprint to move incomplete tasks
  const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, include: { tasks: { select: { id: true, column: { select: { isDefault: true } } } } } });
  if (!sprint) { res.status(404).json({ success: false, error: 'Sprint não encontrada.' }); return; }

  // Move incomplete tasks
  const incompleteTasks = sprint.tasks.filter(t => !t.column?.isDefault).map(t => t.id);
  if (incompleteTasks.length && moveToSprintId) {
    await prisma.task.updateMany({ where: { id: { in: incompleteTasks } }, data: { sprintId: moveToSprintId } });
  } else if (incompleteTasks.length) {
    await prisma.task.updateMany({ where: { id: { in: incompleteTasks } }, data: { sprintId: null } });
  }

  const completedPoints = sprint.tasks.filter(t => t.column?.isDefault).length;
  const updated = await prisma.sprint.update({
    where: { id: req.params.id },
    data: { status: 'COMPLETED', endDate: new Date(), velocity: completedPoints },
  });
  res.json({ success: true, data: updated });
});

// DELETE /api/sprints/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.task.updateMany({ where: { sprintId: req.params.id }, data: { sprintId: null } });
  await prisma.sprint.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// POST /api/sprints/:id/clone — duplicate sprint structure (no tasks, status = PLANNING)
router.post('/:id/clone', async (req: AuthRequest, res: Response) => {
  try {
    const source = await prisma.sprint.findUnique({ where: { id: req.params.id } });
    if (!source) { res.status(404).json({ success: false, error: 'Sprint não encontrada.' }); return; }

    const cloned = await prisma.sprint.create({
      data: {
        name:      `${source.name} (Cópia)`,
        goal:      source.goal ?? undefined,
        projectId: source.projectId,
        status:    'PLANNING',
      },
    });
    res.status(201).json({ success: true, data: cloned });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Erro interno.' });
  }
});

export default router;
