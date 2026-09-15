/**
 * Catalogue of AI agents / MCP clients and how to install the Markdown Studio
 * MCP server into each of them. Used by the "Add to AI agent" dialog.
 *
 * Three install kinds:
 *  - deeplink: the browser can hand the config straight to the app (one click)
 *  - cli:      a single terminal command does it
 *  - manual:   paste a config snippet / follow a few clicks in the app
 *
 * Deep-link formats (verified Sept 2026):
 *  Cursor   cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=base64(json)
 *  VS Code  vscode:mcp/install?name=…&config=urlencode(json)   (vscode-insiders: for Insiders)
 *  Goose    goose://extension?type=streamable_http&url=…&id=…&name=…&description=…
 */

export const SERVER_NAME = 'markdown-studio';
export const SERVER_TITLE = 'Markdown Studio';
export const SERVER_DESCRIPTION = 'Write well-formatted Markdown and export polished PDFs';

/** The MCP endpoint for the current deployment. */
export function mcpUrl(origin) {
  const base = (origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://md-to-pdf.vercel.app').replace(/\/$/, '');
  return `${base}/api/mcp`;
}

const b64 = (s) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
};

const j = (v) => JSON.stringify(v, null, 2);

const standardConfig = (url, extra = {}) => j({ mcpServers: { [SERVER_NAME]: { url, ...extra } } });

/**
 * Every supported client. `install(url)` returns everything the UI needs:
 *  { kind, href?, webHref?, command?, config?, configPath?, steps }
 */
export const AGENTS = [
  {
    id: 'cursor',
    name: 'Cursor',
    tagline: 'One-click install',
    color: '#111827',
    initials: 'Cu',
    install(url) {
      const config = b64(JSON.stringify({ url }));
      return {
        kind: 'deeplink',
        href: `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encodeURIComponent(config)}`,
        webHref: `https://cursor.com/install-mcp?name=${SERVER_NAME}&config=${encodeURIComponent(config)}`,
        config: standardConfig(url),
        configPath: '~/.cursor/mcp.json (global) or .cursor/mcp.json (project)',
        steps: ['Cursor opens and shows an install card for "markdown-studio".', 'Click Install, then start a new chat — the tools are available immediately.'],
      };
    },
  },
  {
    id: 'vscode',
    name: 'VS Code',
    tagline: 'One-click install (Copilot)',
    color: '#0078D4',
    initials: 'VS',
    install(url) {
      const cfg = encodeURIComponent(JSON.stringify({ type: 'http', url }));
      return {
        kind: 'deeplink',
        href: `vscode:mcp/install?name=${SERVER_NAME}&config=${cfg}`,
        webHref: `https://insiders.vscode.dev/redirect/mcp/install?name=${SERVER_NAME}&config=${cfg}`,
        command: `code --add-mcp '${JSON.stringify({ name: SERVER_NAME, type: 'http', url })}'`,
        config: j({ servers: { [SERVER_NAME]: { type: 'http', url } } }),
        configPath: '.vscode/mcp.json (workspace) or your user mcp.json',
        steps: ['VS Code opens and asks you to confirm adding the server.', 'Open Copilot Chat in Agent mode and pick the tools icon to confirm it is listed.'],
      };
    },
  },
  {
    id: 'vscode-insiders',
    name: 'VS Code Insiders',
    tagline: 'One-click install',
    color: '#24BFA5',
    initials: 'VI',
    install(url) {
      const cfg = encodeURIComponent(JSON.stringify({ type: 'http', url }));
      return {
        kind: 'deeplink',
        href: `vscode-insiders:mcp/install?name=${SERVER_NAME}&config=${cfg}`,
        webHref: `https://insiders.vscode.dev/redirect/mcp/install?name=${SERVER_NAME}&config=${cfg}&quality=insiders`,
        command: `code-insiders --add-mcp '${JSON.stringify({ name: SERVER_NAME, type: 'http', url })}'`,
        config: j({ servers: { [SERVER_NAME]: { type: 'http', url } } }),
        configPath: '.vscode/mcp.json (workspace) or your user mcp.json',
        steps: ['VS Code Insiders opens and asks you to confirm adding the server.'],
      };
    },
  },
  {
    id: 'goose',
    name: 'Goose',
    tagline: 'One-click install',
    color: '#1F2937',
    initials: 'Go',
    install(url) {
      const q = new URLSearchParams({ type: 'streamable_http', url, id: SERVER_NAME, name: SERVER_TITLE, description: SERVER_DESCRIPTION, timeout: '300' });
      return {
        kind: 'deeplink',
        href: `goose://extension?${q.toString()}`,
        command: `goose session --with-streamable-http-extension "${url}"`,
        steps: ['Goose opens and adds "Markdown Studio" as an extension.', 'Start a new session to use it.'],
      };
    },
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    tagline: 'One terminal command',
    color: '#D97757',
    initials: 'CC',
    install(url) {
      return {
        kind: 'cli',
        command: `claude mcp add --transport http ${SERVER_NAME} ${url}`,
        config: standardConfig(url, { type: 'http' }),
        configPath: '.mcp.json (project) — or use the command',
        steps: ['Run the command in your terminal (add `-s user` to install for all projects).', 'Restart Claude Code; type /mcp to confirm the server is connected.'],
      };
    },
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    tagline: 'One terminal command',
    color: '#000000',
    initials: 'Cx',
    install(url) {
      return {
        kind: 'cli',
        command: `codex mcp add ${SERVER_NAME} --url ${url}`,
        config: `[mcp_servers.${SERVER_NAME}]\nurl = "${url}"`,
        configPath: '~/.codex/config.toml',
        steps: ['Run the command, or paste the TOML into ~/.codex/config.toml.', 'Start a new Codex session; `codex mcp list` shows the server.'],
      };
    },
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    tagline: 'One terminal command',
    color: '#1A73E8',
    initials: 'Ge',
    install(url) {
      return {
        kind: 'cli',
        command: `gemini mcp add --transport http -s user ${SERVER_NAME} ${url}`,
        config: j({ mcpServers: { [SERVER_NAME]: { httpUrl: url } } }),
        configPath: '~/.gemini/settings.json',
        steps: ['Run the command (drop `-s user` to add it to the current project only).', 'In a session, type /mcp to confirm the connection.'],
      };
    },
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop / claude.ai',
    tagline: 'Add as a connector',
    color: '#D97757',
    initials: 'Cl',
    install(url) {
      return {
        kind: 'manual',
        copy: url,
        steps: ['Open Settings → Connectors → Add custom connector.', 'Paste the server URL, name it "Markdown Studio" and click Add.', 'Enable it from the tools (+) menu in a new chat.'],
      };
    },
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    tagline: 'Add as a connector',
    color: '#10A37F',
    initials: 'GP',
    install(url) {
      return {
        kind: 'manual',
        copy: url,
        steps: ['Settings → Apps & Connectors → Advanced settings → enable Developer mode.', 'Back in Connectors, click Create, paste the server URL and choose "No authentication".', 'In a new chat, add the connector from the tools menu.'],
      };
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    tagline: 'Paste a config snippet',
    color: '#0EA5E9',
    initials: 'Wi',
    install(url) {
      return {
        kind: 'manual',
        config: j({ mcpServers: { [SERVER_NAME]: { serverUrl: url } } }),
        configPath: '~/.codeium/windsurf/mcp_config.json',
        steps: ['Open Cascade → MCP servers (hammer icon) → Configure, or edit the file directly.', 'Merge the snippet into "mcpServers" and save; Windsurf reloads the servers.'],
      };
    },
  },
  {
    id: 'other',
    name: 'Other MCP client',
    tagline: 'Standard mcp.json',
    color: '#6B7280',
    initials: '…',
    install(url) {
      return {
        kind: 'manual',
        copy: url,
        config: standardConfig(url),
        configPath: 'your client\'s MCP config file',
        steps: ['Any client that supports remote (Streamable HTTP) MCP servers works — paste the URL, or merge the snippet into its mcp.json.', `stdio-only clients: use "npx -y mcp-remote ${url}" as the command.`],
      };
    },
  },
];

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id);
}
