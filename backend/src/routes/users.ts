import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/users — list all users
router.get('/', async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, color: true, avatarUrl: true, phone: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: users });
});

// PATCH /api/users/:id — update profile fields
const UpdateSchema = z.object({
  name:      z.string().min(2).max(100).optional(),
  color:     z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  phone:     z.string().nullable().optional(),
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const body = UpdateSchema.parse(req.body);
    // Users can only edit their own profile unless ADMIN
    if (req.user!.userId !== req.params.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Sem permissão.' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, name: true, email: true, role: true, color: true, avatarUrl: true, phone: true },
    });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message ?? 'Erro ao atualizar.' });
  }
});

export default router;
