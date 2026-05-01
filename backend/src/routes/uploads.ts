import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate as any);

// Ensure uploads dir exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    cb(null, `${uniq}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// POST /api/uploads  (multipart/form-data, field: "file")
router.post('/', upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
    return;
  }

  // Build a URL the browser can reach.
  // In production behind Render the host header is the public hostname.
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] ?? req.protocol;
  const host  = req.get('host');
  const url   = `${proto}://${host}/uploads/${req.file.filename}`;

  res.json({
    success: true,
    data: {
      url,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size:     req.file.size,
    },
  });
});

export default router;
