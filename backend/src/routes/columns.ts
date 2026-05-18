import { prisma } from '../lib/prisma';
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

const ColSchema = z.object({
  name:      z.string().min(1).max(100),
  color:     z.string().default('#64748b'),
  order:     z.number().int().optional(),
  isDefault: z.boolean().optional(),
  projectId: z.string().uuid(),
});

// GET /api/columns?projectId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query as { projectId: string };
  const cols = await prisma.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    include: { _count: { select: { tasks: true } } },
  });
  res.json({ success: true, data: cols });
});

// POST /api/columns
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = ColSchema.parse(req.body);
    const lastCol = await prisma.kanbanColumn.findFirst({ where: { projectId: body.projectId }, orderBy: { order: 'desc' } });
    const col = await prisma.kanbanColumn.create({
      data: { ...body, order: body.order ?? (lastCol ? lastCol.order + 1 : 0) },
    });
    res.status(201).json({ success: true, data: col });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// PATCH /api/columns/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { name, color, order, isDefault } = req.body;
  const col = await prisma.kanbanColumn.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(color && { color }), ...(order !== undefined && { order }), ...(isDefault !== undefined && { isDefault }) },
  });
  res.json({ success: true, data: col });
});

// DELETE /api/columns/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  // Move tasks in this column to backlog (null column) before deleting
  await prisma.task.updateMany({ where: { columnId: req.params.id }, data: { columnId: null } });
  await prisma.kanbanColumn.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Coluna removida. Tasks movidas para o backlog.' });
});

// POST /api/columns/reorder
router.post('/reorder', async (req: AuthRequest, res: Response) => {
  const { updates } = req.body as { updates: Array<{ id: string; order: number }> };
  await Promise.all(updates.map(u => prisma.kanbanColumn.update({ where: { id: u.id }, data: { order: u.order } })));
  res.json({ success: true });
});

export default router;
