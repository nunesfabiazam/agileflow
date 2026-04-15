import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

// GET /api/users — list all users (for assignee picker)
router.get('/', async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, color: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: users });
});

// PATCH /api/users/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (req.user!.userId !== req.params.id && req.user!.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Sem permissão.' }); return;
  }
  const { name, color, avatarUrl, role } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(name      && { name }),
      ...(color     && { color }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(role && req.user!.role === 'ADMIN' && { role }),
    },
    select: { id: true, name: true, email: true, role: true, color: true, avatarUrl: true },
  });
  res.json({ success: true, data: user });
});

export default router;
