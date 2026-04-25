import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/assist', async (req, res) => {
  const { action, context } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'ANTHROPIC_API_KEY não configurada. Adicione ao .env e ao painel do Render.',
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const ctx = context ?? {};

  const prompts: Record<string, string> = {
    'task-description': `Você é um especialista ágil. Escreva uma descrição clara e objetiva para a seguinte task de software.

Título: ${ctx.title ?? ''}
Tipo: ${ctx.type ?? ''}
${ctx.epic ? `Épico: ${ctx.epic}` : ''}

Escreva 2-4 parágrafos descrevendo o que precisa ser feito, o contexto de negócio e o valor entregue.
Responda apenas com a descrição, sem títulos ou formatação markdown.`,

    'suggest-criteria': `Você é um especialista ágil. Sugira critérios de aceite para a seguinte task.

Título: ${ctx.title ?? ''}
${ctx.description ? `Descrição: ${ctx.description}` : ''}

Gere 4-6 critérios de aceite concisos e testáveis.
Cada critério deve:
- Começar com um verbo no infinitivo (ex: "Validar", "Exibir", "Permitir")
- Ser específico e mensurável
- Estar em português brasileiro

Responda apenas com os critérios, um por linha, sem numeração ou marcadores.`,

    'estimate-points': `Você é um especialista ágil em estimativas de story points (Fibonacci: 1, 2, 3, 5, 8, 13, 21).

Título: ${ctx.title ?? ''}
Tipo: ${ctx.type ?? ''}
${ctx.description ? `Descrição: ${ctx.description}` : ''}
${ctx.criteria ? `Critérios: ${ctx.criteria}` : ''}

Estime o esforço em story points considerando complexidade, incerteza e esforço.
Responda APENAS com JSON válido neste formato exato: {"points": 5, "justification": "Motivo breve em português"}`,

    'summarize-doc': `Você é um assistente de documentação técnica. Resuma o documento a seguir.

Título: ${ctx.title ?? ''}
Conteúdo:
${String(ctx.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)}

Escreva um resumo executivo em 3-5 frases em português. Seja direto e objetivo.
Responda apenas com o resumo, sem formatação markdown.`,

    'improve-text': `Você é um editor técnico especializado em documentação de software.

Melhore o seguinte texto mantendo o sentido original:
"${String(ctx.text ?? '').slice(0, 3000)}"

Regras:
- Mantenha o idioma original (português se for português, inglês se for inglês)
- Seja mais claro, objetivo e profissional
- Corrija gramática e fluência
- Não adicione informações novas

Responda apenas com o texto melhorado, sem aspas ou explicações.`,
  };

  const prompt = prompts[action];
  if (!prompt) {
    return res.status(400).json({ success: false, error: `Ação desconhecida: ${action}` });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return res.json({ success: true, data: { result: text } });
  } catch (err: any) {
    console.error('[AI] Error:', err?.message ?? err);
    return res.status(500).json({ success: false, error: err?.message ?? 'Erro na chamada à IA' });
  }
});

export default router;
