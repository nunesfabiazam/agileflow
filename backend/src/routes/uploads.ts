import { Router, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

// ── Google Drive auth ─────────────────────────────────────────────────────────
function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado.');
  const creds = JSON.parse(raw);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '1_2zCaVgmWv2bYDVf_3gBF5Nll9JX11hJ';

// ── Multer: keep files in memory (buffer), no local disk ─────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// ── POST /api/uploads ─────────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
    return;
  }

  try {
    const drive = getDriveClient();

    // Upload to Drive
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

    // Make file accessible to anyone with the link
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    // Build URLs
    const isImage = req.file.mimetype.startsWith('image/');
    // For images: direct render URL; for others: view/download URL
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
    console.error('Drive upload error:', err?.message ?? err);
    res.status(500).json({ success: false, error: 'Falha no upload para o Google Drive.' });
  }
});

export default router;
