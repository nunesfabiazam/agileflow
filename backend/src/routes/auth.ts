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
    if (!user) {
      res.status(401).json({ success: false, error: 'E-mail não encontrado.' });
      return;
    }
    if (!user.isActive) {
      res.status(401).json({ success: false, error: 'Conta desativada. Fale com o administrador.' });
      return;
    }
    if (!(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ success: false, error: 'Senha incorreta.' });
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


// ─── Forgot Password (SMS via Twilio) ────────────────────────────────────────

const ForgotSchema = z.object({
  phone: z.string().min(10),
});

const VerifyTokenSchema = z.object({
  phone: z.string().min(10),
  token: z.string().length(6),
});

const ResetPasswordSchema = z.object({
  phone: z.string().min(10),
  token: z.string().length(6),
  newPassword: z.string().min(6),
});

router.post('/forgot-password', async (req, res) => {
  const parse = ForgotSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Telefone inválido.' });

  const { phone } = parse.data;
  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, resetToken: true, resetTokenExpiry: true },
  });
  if (!user) return res.json({ success: true }); // Don't reveal if user exists

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone  = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    console.warn('[forgot-password] Twilio env vars not set — token:', token);
    return res.json({ success: true, _dev_token: token });
  }

  try {
    const twilio = require('twilio')(accountSid, authToken);
    await twilio.messages.create({
      body: `AgileFlow: seu código de redefinição de senha é ${token}. Válido por 15 minutos.`,
      from: fromPhone,
      to: phone,
    });
  } catch (err: any) {
    console.error('[twilio]', err.message);
    return res.status(502).json({ error: 'Falha ao enviar SMS. Verifique as configurações do Twilio.' });
  }

  return res.json({ success: true });
});

router.post('/verify-reset-token', async (req, res) => {
  const parse = VerifyTokenSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { phone, token } = parse.data;
  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, resetToken: true, resetTokenExpiry: true },
  });

  if (
    !user ||
    user.resetToken !== token ||
    !user.resetTokenExpiry ||
    new Date() > user.resetTokenExpiry
  ) {
    return res.status(400).json({ error: 'Código inválido ou expirado.' });
  }

  return res.json({ success: true });
});

router.post('/reset-password', async (req, res) => {
  const parse = ResetPasswordSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { phone, token, newPassword } = parse.data;
  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, resetToken: true, resetTokenExpiry: true },
  });

  if (
    !user ||
    user.resetToken !== token ||
    !user.resetTokenExpiry ||
    new Date() > user.resetTokenExpiry
  ) {
    return res.status(400).json({ error: 'Código inválido ou expirado.' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
  });

  return res.json({ success: true });
});

export default router;
