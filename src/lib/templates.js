/**
 * Starter documents. Each template can suggest design settings that are
 * merged over the user's current settings when applied.
 */

export const WELCOME_DOCUMENT = `# Welcome to Markdown Studio

Write on the left, watch the exact document you'll export on the right. Everything you see in the preview — fonts, colours, logo, header and footer — is what ends up in the PDF.

## What's new

- **Design panel** — pick a theme, fonts, paper size, margins and a page background.
- **Branding** — upload a logo and place it beside the title, on every page, or as a watermark.
- **Running header & footer** — add your company name, the date and page numbers.
- **Cover page & table of contents** — turn them on with one switch.
- **Live preview** — the page on the right updates as you type. Switch to *PDF* to see the real rendered file.

> [!TIP]
> Drop a \`.md\` file anywhere on the editor to open it. Paste or drop an image to embed it.

## Formatting cheatsheet

| Syntax | Result |
| --- | --- |
| \`**bold**\` | **bold** |
| \`*italic*\` | *italic* |
| \`~~strike~~\` | ~~strike~~ |
| \`\\\`code\\\`\` | \`code\` |
| \`[link](https://example.com)\` | [link](https://example.com) |
| \`![alt](asset:name.png)\` | embedded image |

### Code with a title

\`\`\`ts title="src/greet.ts"
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Task lists

- [x] Pick a theme
- [x] Add a logo
- [ ] Export the PDF

### Callouts

> [!NOTE]
> Use \`> [!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\` or \`[!CAUTION]\` for GitHub-style callouts.

### Diagrams

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B(Design settings) --> C{Preview}
  C -->|Looks right| D[Export PDF]
  C -->|Tweak| B
\`\`\`

### Footnotes & page breaks

Footnotes work like this[^1]. To force a new page, put \`\\pagebreak\` on its own line.

[^1]: They are collected at the end of the document.
`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from an empty page.',
    markdown: '# Untitled\n\n',
  },
  {
    id: 'welcome',
    name: 'Feature tour',
    description: 'Every supported Markdown feature in one document.',
    markdown: WELCOME_DOCUMENT,
    settings: { theme: 'clean', toc: false },
  },
  {
    id: 'report',
    name: 'Business report',
    description: 'Cover page, contents, numbered sections.',
    settings: { theme: 'corporate', toc: true, headingNumbers: true, cover: { enabled: true, subtitle: 'Quarterly performance review', author: 'Prepared by the Strategy team', date: 'Q3 2026', showLogo: true }, header: { text: '{title}', showDate: true }, footer: { text: 'Confidential — internal use only', pageNumbers: true, pageNumberStyle: 'n-of-total' }, pageBreaks: 'h1' },
    markdown: `# Quarterly Business Review

## Executive summary

Revenue grew **18% quarter-over-quarter**, driven primarily by expansion in the enterprise segment. Gross margin held steady at 71% while operating expenses grew slower than revenue for the second consecutive quarter.

> [!IMPORTANT]
> Net revenue retention reached 124%, the highest in company history.

## Key metrics

| Metric | Q2 | Q3 | Change |
| --- | ---: | ---: | ---: |
| ARR | $12.4M | $14.6M | +18% |
| New customers | 84 | 112 | +33% |
| Net revenue retention | 118% | 124% | +6 pts |
| Gross margin | 70% | 71% | +1 pt |
| CAC payback (months) | 14 | 12 | −2 |

## Highlights

1. **Enterprise expansion.** Three Fortune 500 logos closed, including our largest deal to date.
2. **Product velocity.** 42 features shipped; the new reporting module drove a 22% increase in weekly active usage.
3. **Efficiency.** Sales cycle shortened from 61 to 48 days.

## Risks & mitigations

- **Concentration risk** — top 10 customers represent 34% of ARR. *Mitigation:* mid-market push in Q4.
- **Hiring** — engineering is 6 heads behind plan. *Mitigation:* two new recruiting partners onboarded.

# Outlook

## Q4 priorities

- [ ] Launch self-serve tier
- [ ] Complete SOC 2 Type II
- [ ] Expand into DACH region

## Forecast

\`\`\`mermaid
xychart-beta
  title "ARR forecast ($M)"
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "ARR" 8 --> 20
  bar [10.2, 12.4, 14.6, 17.1]
\`\`\`
`,
  },
  {
    id: 'proposal',
    name: 'Project proposal',
    description: 'Scope, timeline, budget and acceptance.',
    settings: { theme: 'editorial', toc: false, cover: { enabled: false }, header: { text: 'Proposal — {title}', showDate: false }, footer: { text: 'Studio North · hello@studionorth.example', pageNumbers: true } },
    markdown: `# Website Redesign Proposal

**Prepared for:** Acme Corp  
**Prepared by:** Studio North  
**Date:** September 2026  
**Valid until:** 30 October 2026

## Overview

Acme's current website was launched in 2019 and no longer reflects the company's positioning or supports its lead-generation goals. This proposal outlines a complete redesign focused on clarity, speed and conversion.

## Objectives

- Increase qualified demo requests by **40%** within six months of launch
- Reduce page load time to under **1.5s** on mobile
- Establish a scalable design system for future campaigns

## Scope of work

### Phase 1 — Discovery (2 weeks)
Stakeholder interviews, analytics audit, competitor review and content inventory.

### Phase 2 — Design (4 weeks)
Information architecture, wireframes, visual design for 12 core templates, and an interactive prototype.

### Phase 3 — Build (5 weeks)
Front-end implementation, CMS integration, accessibility review (WCAG 2.2 AA) and performance tuning.

### Phase 4 — Launch (1 week)
Content migration, QA, redirects, analytics setup and hand-over training.

## Timeline

\`\`\`mermaid
gantt
  dateFormat  YYYY-MM-DD
  section Project
  Discovery   :a1, 2026-10-06, 14d
  Design      :a2, after a1, 28d
  Build       :a3, after a2, 35d
  Launch      :a4, after a3, 7d
\`\`\`

## Investment

| Item | Fee |
| --- | ---: |
| Discovery | $8,000 |
| Design | $22,000 |
| Build | $34,000 |
| Launch & training | $4,000 |
| **Total** | **$68,000** |

Payment terms: 30% on signature, 40% on design approval, 30% on launch.

## Acceptance

Signing below confirms acceptance of the scope, timeline and investment described in this proposal.

| Acme Corp | Studio North |
| --- | --- |
| Name: | Name: |
| Signature: | Signature: |
| Date: | Date: |
`,
  },
  {
    id: 'readme',
    name: 'Project README',
    description: 'Installation, usage, API and contributing.',
    settings: { theme: 'clean', toc: true },
    markdown: `# acme-cli

> A tiny, fast command-line tool for managing Acme deployments.

[![npm](https://img.shields.io/npm/v/acme-cli.svg)](https://www.npmjs.com/package/acme-cli)

## Installation

\`\`\`bash
npm install -g acme-cli
\`\`\`

## Quick start

\`\`\`bash
acme login
acme deploy ./dist --env production
\`\`\`

## Configuration

Create an \`acme.config.json\` in your project root:

\`\`\`json title="acme.config.json"
{
  "project": "marketing-site",
  "regions": ["eu-west-1", "us-east-1"],
  "build": { "command": "npm run build", "output": "dist" }
}
\`\`\`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`project\` | string | — | Project identifier |
| \`regions\` | string[] | \`["us-east-1"]\` | Deployment regions |
| \`build.command\` | string | \`npm run build\` | Build command |

## API

### \`deploy(path, options)\`

Deploys the given directory. Returns a \`Promise<Deployment>\`.

\`\`\`ts
import { deploy } from 'acme-cli';

const result = await deploy('./dist', { env: 'staging' });
console.log(result.url);
\`\`\`

> [!WARNING]
> Deployments to \`production\` require an approved release in the dashboard.

## Contributing

1. Fork the repository
2. Create a branch: \`git checkout -b feature/my-change\`
3. Commit and open a pull request

## License

MIT © Acme Inc.
`,
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, decisions and action items.',
    settings: { theme: 'forest', footer: { text: '', pageNumbers: true }, header: { text: '', showDate: true } },
    markdown: `# Product Sync — 15 September 2026

**Attendees:** Maya (PM), Jonas (Eng), Priya (Design), Lee (Support)  
**Facilitator:** Maya · **Notes:** Priya

## Agenda

1. Launch readiness for v2.3
2. Support escalations
3. Roadmap check-in

## Discussion

### 1. Launch readiness
QA is 90% complete. Two P1 bugs remain in the export flow; Jonas expects fixes by Wednesday. Marketing assets are approved.

### 2. Support escalations
Lee reported a spike in tickets about slow report generation for large accounts. Root cause traced to an unindexed query.

### 3. Roadmap
Priya presented early concepts for the new dashboard. Team agreed to run a five-user usability test before committing to the layout.

## Decisions

- ✅ Ship v2.3 on **Thursday** if P1 bugs are closed by Wednesday EOD
- ✅ Add the report-generation fix to the release
- ⏸ Dashboard redesign paused until usability results are in

## Action items

- [ ] **Jonas** — fix export P1s (Wed)
- [ ] **Jonas** — add index to \`reports.account_id\` (Wed)
- [ ] **Priya** — recruit five users for testing (Fri)
- [ ] **Lee** — draft release notes for support team (Thu)
- [ ] **Maya** — send launch announcement (Thu)

## Next meeting

Monday 22 September, 10:00 — same room.
`,
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Line items, totals and payment details.',
    settings: { theme: 'mono', footer: { text: 'Thank you for your business.', pageNumbers: false }, header: { text: '', showDate: false }, logo: null },
    markdown: `# Invoice #2026-041

|  |  |
| --- | --- |
| **From** | Studio North Ltd · 12 Harbour Lane · Oslo |
| **To** | Acme Corp · Attn: Accounts Payable · 400 Main St · Austin, TX |
| **Issue date** | 15 September 2026 |
| **Due date** | 15 October 2026 (Net 30) |

## Items

| # | Description | Qty | Unit price | Amount |
| --- | --- | ---: | ---: | ---: |
| 1 | Discovery workshop | 1 | $8,000.00 | $8,000.00 |
| 2 | Visual design (12 templates) | 12 | $1,800.00 | $21,600.00 |
| 3 | Front-end implementation | 160 h | $150.00 | $24,000.00 |
| 4 | Accessibility audit | 1 | $2,400.00 | $2,400.00 |

| | |
| --- | ---: |
| Subtotal | $56,000.00 |
| VAT (25%) | $14,000.00 |
| **Total due** | **$70,000.00** |

## Payment details

**Bank:** Nordic Bank ASA  
**IBAN:** NO93 8601 1117 947  
**SWIFT/BIC:** NDEANOKK  
**Reference:** INV-2026-041

> Please include the invoice reference with your payment. Late payments are subject to 1.5% monthly interest.
`,
  },
  {
    id: 'resume',
    name: 'Résumé',
    description: 'A clean single-column CV.',
    settings: { theme: 'clean', fontSize: 'sm', margins: 'narrow', footer: { text: '', pageNumbers: false } },
    markdown: `# Alex Rivera

**Senior Product Designer** · Berlin, Germany  
alex@example.com · +49 170 000 0000 · [alexrivera.design](https://example.com) · [linkedin.com/in/alexrivera](https://example.com)

## Summary

Product designer with 9 years of experience shipping B2B SaaS products used by millions. I lead design from research to delivery, build design systems that scale, and mentor teams toward evidence-based decisions.

## Experience

### Lead Product Designer — Northwind Analytics
*2022 – present · Berlin*

- Led redesign of the reporting suite, lifting weekly active usage by **31%**
- Built and maintain a design system adopted by 6 product teams
- Manage and mentor a team of four designers

### Senior Product Designer — Fabrikam
*2018 – 2022 · Amsterdam*

- Designed onboarding that cut time-to-value from 9 days to 2
- Ran 60+ customer interviews and usability sessions per year
- Partnered with engineering to introduce a token-based theming architecture

### Product Designer — Contoso
*2016 – 2018 · Lisbon*

- Shipped the mobile app from zero to 4.7★ on both stores

## Skills

**Design:** Figma, prototyping, design systems, accessibility (WCAG 2.2)  
**Research:** interviews, usability testing, surveys, analytics  
**Technical:** HTML/CSS, React fundamentals, design tokens

## Education

**BA Interaction Design** — University of the Arts London, 2016
`,
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}
