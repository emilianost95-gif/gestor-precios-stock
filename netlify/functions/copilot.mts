import {
  corsHeaders,
  handleCopilotRequest,
  type CopilotRequestBody,
} from '../../api/_lib/copilotCore';

/**
 * Adaptador para Netlify Functions.
 * Desplegado queda en https://<tu-sitio>.netlify.app/.netlify/functions/copilot
 * (y también en /api/copilot gracias al redirect de netlify.toml).
 *
 * Variables de entorno (Site settings → Environment variables):
 *   ANTHROPIC_API_KEY        (obligatoria, secreta)
 *   ANTHROPIC_MODEL          (opcional)
 *   COPILOT_ALLOWED_ORIGIN   (opcional, recomendado)
 */
export default async function handler(request: Request): Promise<Response> {
  const env = process.env as Record<string, string | undefined>;
  const headers = { ...corsHeaders(env), 'content-type': 'application/json' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Usá POST.' }), { status: 405, headers });
  }

  let body: CopilotRequestBody = {};
  try {
    body = (await request.json()) as CopilotRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'El cuerpo no es JSON válido.' }), {
      status: 400,
      headers,
    });
  }

  const result = await handleCopilotRequest(body, env);
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
