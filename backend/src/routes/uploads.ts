import { Router, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

// ── Google Drive via OAuth2 (user account — has storage quota) ───────────────
function getDriveClient() {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Variáveis GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET ou GOOGLE_DRIVE_REFRESH_TOKEN não configuradas.');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth });
}

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '1_2zCaVgmWv2bYDVf_3gBF5Nll9JX11hJ';

// ── Multer: memória (sem disco local) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// ── POST /api/uploads ────────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
    return;
  }

  try {
    const drive = getDriveClient();

    // Upload para o Drive
    const driveRes = await drive.files.create({
      requestBody: {
        name:    req.file.originalname,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: req.file.mimetype,
        body:     Readable.from(req.file.buffer),
      },
      fields: 'id,name,mimeType,size',
    });

    const fileId = driveRes.data.id!;

    // Torna público (qualquer pessoa com o link pode visualizar)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    // URL de acesso
    const isImage = req.file.mimetype.startsWith('image/');
    const url = isImage
      ? `https://drive.google.com/uc?export=view&id=${fileId}`
      : `https://drive.google.com/file/d/${fileId}/view`;

    res.json({
      success: true,
      data: {
        url,
        fileId,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size:     req.file.size,
      },
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('Drive upload error:', msg);
    res.status(500).json({ success: false, error: 'Falha no upload para o Google Drive.', detail: msg });
  }
});

export default router;
