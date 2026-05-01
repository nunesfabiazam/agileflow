/**
 * Rota temporária para autorizar o Google Drive.
 * Acesse /api/drive-setup/start no browser para iniciar o fluxo OAuth.
 * Após autorizar, o refresh_token será exibido na tela — copie para o Render.
 *
 * REMOVA esta rota após configurar o token.
 */
import { Router, Request, Response } from 'express';
import { google } from 'googleapis';

const router = Router();

const BACKEND_URL = process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
const REDIRECT_URI = `${BACKEND_URL}/api/drive-setup/callback`;

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    REDIRECT_URI,
  );
}

// GET /api/drive-setup/start  →  redireciona para tela de consentimento Google
router.get('/start', (_req: Request, res: Response) => {
  const auth = getOAuth2Client();
  const url  = auth.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',   // força emissão de novo refresh_token
    scope:       ['https://www.googleapis.com/auth/drive'],
  });
  res.redirect(url);
});

// GET /api/drive-setup/callback  →  troca o code pelo refresh_token e exibe
router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as Record<string, string>;

  if (error) {
    res.send(`<h2>Erro: ${error}</h2>`);
    return;
  }
  if (!code) {
    res.send('<h2>Código de autorização não encontrado.</h2>');
    return;
  }

  try {
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);

    if (!tokens.refresh_token) {
      res.send(`
        <h2>⚠️ Refresh token não retornado</h2>
        <p>Isso acontece quando o app já foi autorizado antes. Tente revogar o acesso em
        <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>
        e clique em /api/drive-setup/start novamente.</p>
      `);
      return;
    }

    res.send(`
      <h2>✅ Sucesso! Copie o token abaixo para o Render:</h2>
      <p><strong>Nome da variável:</strong> <code>GOOGLE_DRIVE_REFRESH_TOKEN</code></p>
      <p><strong>Valor:</strong></p>
      <textarea rows="3" style="width:100%;font-size:13px">${tokens.refresh_token}</textarea>
      <br><br>
      <p>Após salvar no Render, você pode remover a variável de ambiente GOOGLE_DRIVE_REFRESH_TOKEN
      antiga e excluir esta rota do código.</p>
    `);
  } catch (err: any) {
    res.send(`<h2>Erro ao trocar código: ${err.message}</h2>`);
  }
});

export default router;
