import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate as any);

// ── Admin-only guard ──────────────────────────────────────────────────────────
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas administradores podem realizar esta ação.' });
  }
  next();
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/', adminOnly, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      color: true, avatarUrl: true, phone: true,
      isActive: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ success: true, data: users });
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
const CreateUserSchema = z.object({
  name:      z.string().min(2),
  email:     z.string().email(),
  password:  z.string().min(6),
  role:      z.nativeEnum(UserRole).default(UserRole.DEVELOPER),
  color:     z.string().default('#6366f1'),
  phone:     z.string().optional(),
  avatarUrl: z.string().optional(),
});

router.post('/', adminOnly, async (req: Request, res: Response) => {
  const parse = CreateUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.', details: parse.error.flatten() });

  const { name, email, password, role, color, phone, avatarUrl } = parse.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name, email, password: hashed, role, color,
      phone: phone ?? null, avatarUrl: avatarUrl ?? null, isActive: true,
    },
    select: {
      id: true, name: true, email: true, role: true,
      color: true, avatarUrl: true, phone: true, isActive: true, createdAt: true,
    },
  });

  return res.status(201).json({ success: true, data: user });
});

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────
const UpdateUserSchema = z.object({
  name:      z.string().min(2).optional(),
  email:     z.string().email().optional(),
  phone:     z.string().nullable().optional(),
  password:  z.string().min(6).optional(),
  role:      z.nativeEnum(UserRole).optional(),
  isActive:  z.boolean().optional(),
  color:     z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
});

router.patch('/:id', adminOnly, async (req: Request, res: Response) => {
  const parse = UpdateUserSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { id } = req.params;

  // Check email uniqueness if changing
  if (parse.data.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: parse.data.email, id: { not: id } },
    });
    if (conflict) return res.status(409).json({ error: 'E-mail já utilizado por outro usuário.' });
  }

  // Build update payload — hash password if provided
  const { password, ...rest } = parse.data;
  const updateData: Record<string, any> = { ...rest };
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true,
      color: true, avatarUrl: true, phone: true, isActive: true,
    },
  });

  return res.json({ success: true, data: updated });
});

// ── DELETE /api/admin/users/:id (soft delete) ─────────────────────────────────
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params;
  const self   = (req as any).user?.id;
  if (id === self) return res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return res.json({ success: true });
});

export default router;
