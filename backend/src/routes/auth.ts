import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import crypto from 'crypto';

const router = Router();

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


// ─── Forgot Password (Gmail REST API — funciona no Render free tier) ──────────
// O Render bloqueia SMTP (portas 25/465/587). Usamos a Gmail API via HTTPS (443).

function buildEmailHtml(name: string, resetLink: string) {
  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
      <div style="margin-bottom:24px;">
        <span style="display:inline-block;width:40px;height:40px;background:#6366f1;border-radius:10px;font-weight:800;color:#fff;font-size:16px;line-height:40px;text-align:center;">AF</span>
        <span style="font-size:20px;font-weight:800;color:#0f172a;vertical-align:middle;margin-left:10px;">AgileFlow</span>
      </div>
      <h2 style="color:#0f172a;font-size:18px;margin:0 0 8px;">Olá, ${name} 👋</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Recebemos uma solicitação para redefinir a senha da sua conta.<br/>
        Clique no botão abaixo para criar uma nova senha:
      </p>
      <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        Redefinir minha senha
      </a>
      <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;line-height:1.6;">
        Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#cbd5e1;font-size:11px;text-align:center;margin:0;">AgileFlow · Gestão ágil de projetos</p>
    </div>
  `;
}

async function sendViaGmailApi(to: string, subject: string, html: string): Promise<void> {
  // 1. Trocar refresh_token por access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`OAuth token error: ${txt}`);
  }
  const { access_token } = await tokenRes.json() as { access_token: string };

  // 2. Montar mensagem RFC 2822 e codificar em base64url
  // Assuntos com acentos precisam de encoded-word (RFC 2047) para não quebrar
  const encodedSubject = `=?utf-8?b?${Buffer.from(subject).toString('base64')}?=`;
  const raw = [
    `From: AgileFlow <${process.env.GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n');
  const encoded = Buffer.from(raw).toString('base64url');

  // 3. Enviar via Gmail API (HTTPS — porta 443, nunca bloqueada)
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!sendRes.ok) {
    const txt = await sendRes.text();
    throw new Error(`Gmail API send error: ${txt}`);
  }
}

const ForgotSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  email:       z.string().email(),
  token:       z.string().min(32),
  newPassword: z.string().min(6),
});

router.post('/forgot-password', async (req, res) => {
  try {
    const parse = ForgotSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'E-mail inválido.' });

    const { email } = parse.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    // Sempre retorna sucesso para não revelar se o e-mail existe
    if (!user) return res.json({ success: true });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://agileflow-kappa.vercel.app';
    const resetLink   = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const configured = process.env.GMAIL_CLIENT_ID
                    && process.env.GMAIL_CLIENT_SECRET
                    && process.env.GMAIL_REFRESH_TOKEN
                    && process.env.GMAIL_USER;

    if (!configured) {
      // Modo dev: devolve o link no body para testar sem configurar Gmail API
      console.warn('[forgot-password] Gmail API não configurada. Link de reset:', resetLink);
      return res.json({ success: true, _dev_link: resetLink });
    }

    await sendViaGmailApi(email, 'Redefinição de senha — AgileFlow', buildEmailHtml(user.name, resetLink));
    return res.json({ success: true });

  } catch (err: any) {
    // Loga o erro real para diagnóstico nos logs do Render
    console.error('[forgot-password] Erro:', err.message, err.code ?? '');
    return res.status(500).json({
      error: 'Falha ao enviar e-mail.',
      detail: err.message,   // temporário para diagnóstico
      code:   err.code ?? null,
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const parse = ResetPasswordSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Dados inválidos.' });

    const { email, token, newPassword } = parse.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, resetToken: true, resetTokenExpiry: true },
    });

    if (
      !user ||
      user.resetToken !== token ||
      !user.resetTokenExpiry ||
      new Date() > user.resetTokenExpiry
    ) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[reset-password]', err.message);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

export default router;
