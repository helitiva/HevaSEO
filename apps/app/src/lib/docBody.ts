import type { DocBlock } from '@/data/staffDocs';

// A tiny, safe markdown-lite for admin-authored docs. No raw HTML is ever produced —
// the text is parsed into the same structured DocBlock list the seed docs use, so the
// reader (DocArticle) renders admin docs and seeds identically and nothing can inject markup.
//
// Block rules (blocks separated by a blank line):
//   # Heading            → { h }
//   > callout text       → { callout, info }   (>! warn, >* tip)
//   - item / * item      → { ul }
//   1. item              → { ol }
//   ``` … ```            → { code }   (fenced)
//   anything else        → { p }
export function parseDocBody(text: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const chunks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);

    if (chunk.startsWith('```')) {
      blocks.push({ type: 'code', text: chunk.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '') });
      continue;
    }
    if (lines[0].startsWith('# ')) {
      blocks.push({ type: 'h', text: lines[0].slice(2).trim() });
      const rest = lines.slice(1).join(' ').trim();
      if (rest) blocks.push({ type: 'p', text: rest });
      continue;
    }
    if (lines[0].startsWith('>')) {
      const tone = lines[0].startsWith('>!') ? 'warn' : lines[0].startsWith('>*') ? 'tip' : 'info';
      const txt = lines.map((l) => l.replace(/^>[!*]?\s?/, '')).join(' ').trim();
      blocks.push({ type: 'callout', tone, text: txt });
      continue;
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({ type: 'ul', items: lines.map((l) => l.replace(/^[-*]\s+/, '')) });
      continue;
    }
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      blocks.push({ type: 'ol', items: lines.map((l) => l.replace(/^\d+[.)]\s+/, '')) });
      continue;
    }
    blocks.push({ type: 'p', text: lines.join(' ') });
  }
  return blocks;
}

// Turn structured blocks back into editable markdown-lite (for editing an existing doc).
export function serializeDocBody(blocks: DocBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h': return `# ${b.text}`;
        case 'p': return b.text;
        case 'ul': return b.items.map((i) => `- ${i}`).join('\n');
        case 'ol': return b.items.map((i, n) => `${n + 1}. ${i}`).join('\n');
        case 'code': return '```\n' + b.text + '\n```';
        case 'callout': return `${b.tone === 'warn' ? '>!' : b.tone === 'tip' ? '>*' : '>'} ${b.text}`;
      }
    })
    .join('\n\n');
}

// Rough read-time estimate from the body text (~200 wpm, min 1).
export function estimateReadMins(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
