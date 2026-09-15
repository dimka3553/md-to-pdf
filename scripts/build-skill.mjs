#!/usr/bin/env node
/**
 * Generate `skills/markdown-studio/SKILL.md` (Agent Skills standard, used by the
 * Cursor / Claude Code plugin) from the same guide the MCP server serves, so the
 * two can never drift apart. Run with `npm run build:skill`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKDOWN_GUIDE, GUIDE_VERSION } from '../src/lib/mcp/guide.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'skills/markdown-studio/SKILL.md');
const MCP_URL = 'https://md-to-pdf.vercel.app/api/mcp';

const frontmatter = `---
name: markdown-studio
description: Write well-formatted Markdown documents and export them as polished PDFs with Markdown Studio. Use when asked to write, format, polish or export a report, proposal, README, meeting notes, invoice, résumé or any document destined for PDF/print, or when Markdown must render correctly in Markdown Studio (md-to-pdf).
---
`;

const preamble = `<!-- Generated from src/lib/mcp/guide.js (v${GUIDE_VERSION}) by scripts/build-skill.mjs — do not edit by hand. -->

## Tooling

Markdown Studio exposes a remote MCP server at \`${MCP_URL}\` (Streamable HTTP, no auth by default). If it is connected, prefer its tools over guessing:

| Tool | Use it to |
| --- | --- |
| \`get_markdown_guide\` | Read the full authoring guide (same content as below) |
| \`list_templates\` / \`get_template\` | Start from a proven structure with matching design settings |
| \`list_design_options\` | See every valid \`settings\` value (themes, fonts, paper, …) |
| \`analyze_markdown\` | Lint before rendering; fix every warning it reports |
| \`render_html\` | Quick standalone HTML preview |
| \`render_pdf\` | Final PDF (returned as a base64 \`application/pdf\` resource) |

Without the MCP server you can still POST \`{"markdown","settings","fileName"}\` to \`https://md-to-pdf.vercel.app/api/convert\` and save the PDF response body.

To connect the MCP server in Cursor add to \`.cursor/mcp.json\`:

\`\`\`json
{ "mcpServers": { "markdown-studio": { "url": "${MCP_URL}" } } }
\`\`\`

In Claude Code: \`claude mcp add --transport http markdown-studio ${MCP_URL}\`

---

`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, frontmatter + '\n' + preamble + MARKDOWN_GUIDE);
console.log(`wrote ${out} (${MARKDOWN_GUIDE.length} guide chars)`);
