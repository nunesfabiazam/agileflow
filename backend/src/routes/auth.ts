import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

const RegisterSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.enum(['ADMIN','PM','DEVELOPER','QA','UX','SCRUM_MASTER','STAKEHOLDER','VIEWER']).optional(),
  color:    z.string().optional(),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      res.status(409).json({ success: false, error: 'E-mail já cadastrado.' });
      return;
    }
    const hashed = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        role: body.role ?? 'DEVELOPER',
        color: body.color ?? '#6366f1',
      },
      select: { id: true, name: true, email: true, role: true, color: true, createdAt: true },
    });
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors });
    } else {
      res.status(500).json({ success: false, error: 'Erro interno.' });
    }
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
      return;
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    const { password: _, ...safeUser } = user;
    res.json({ success: true, data: { user: safeUser, token } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors });
    } else {
      res.status(500).json({ success: false, error: 'Erro interno.' });
    }
  }
});

// GET /api/auth/me
router.get('/me', authenticate as any, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, color: true, avatarUrl: true, createdAt: true },
  });
  res.json({ success: true, data: user });
});

export default router;
