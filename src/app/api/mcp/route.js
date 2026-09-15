import { createMcpHandler } from 'mcp-handler';
import { registerMarkdownStudio, SERVER_INFO, SERVER_INSTRUCTIONS } from '@/lib/mcp/server.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Remote MCP server (Streamable HTTP, stateless) exposing Markdown Studio to AI agents.
 *
 * Connect any MCP client to  POST https://<host>/api/mcp
 *
 * Authentication is optional: set the MCP_API_KEY environment variable and clients
 * must send `Authorization: Bearer <key>` (Cursor / Claude / VS Code all support a
 * static `headers` map in their MCP config). Leave it unset for an open server.
 */

const mcpCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
};

const mcp = createMcpHandler(registerMarkdownStudio, {
  serverInfo: SERVER_INFO,
  instructions: SERVER_INSTRUCTIONS,
  capabilities: { tools: {}, resources: {}, prompts: {} },
  verboseLogs: process.env.NODE_ENV === 'development',
});

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(mcpCors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorized(message) {
  return new Response(JSON.stringify({ error: 'unauthorized', message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="markdown-studio"', ...mcpCors },
  });
}

/** Constant-time string comparison so key checks don't leak length/prefix information. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function authorize(request) {
  const required = process.env.MCP_API_KEY;
  if (!required) return null;
  const header = request.headers.get('authorization') || '';
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = bearer || request.headers.get('x-api-key') || new URL(request.url).searchParams.get('key');
  if (!token) return unauthorized('This MCP server requires an API key. Send it as "Authorization: Bearer <key>".');
  if (!safeEqual(token, required)) return unauthorized('Invalid API key.');
  return null;
}

async function handle(request) {
  const denied = authorize(request);
  if (denied) return denied;
  const response = await mcp(request);
  return withCors(response);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCors });
}

export { handle as GET, handle as POST, handle as DELETE };
