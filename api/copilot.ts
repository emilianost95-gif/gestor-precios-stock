import { corsHeaders, handleCopilotRequest, type CopilotRequestBody } from './_lib/copilotCore';

/**
 * Adaptador para Vercel Serverless Functions.
 * Desplegado queda en https://<tu-proyecto>.vercel.app/api/copilot
 *
 * Variables de entorno necesarias (Project Settings → Environment Variables):
 *   ANTHROPIC_API_KEY        (obligatoria, secreta)
 *   ANTHROPIC_MODEL          (opcional)
 *   COPILOT_ALLOWED_ORIGIN   (opcional, recomendado: la URL de tu app)
 */

interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const env = process.env as Record<string, string | undefined>;

  for (const [name, value] of Object.entries(corsHeaders(env))) {
    res.setHeader(name, value);
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Usá POST.' });
    return;
  }

  const body: CopilotRequestBody =
    typeof req.body === 'string' ? safeParse(req.body) : ((req.body ?? {}) as CopilotRequestBody);

  const result = await handleCopilotRequest(body, env);
  res.status(result.status).json(result.body);
}

function safeParse(raw: string): CopilotRequestBody {
  try {
    return JSON.parse(raw) as CopilotRequestBody;
  } catch {
    return {};
  }
}
