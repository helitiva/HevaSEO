import type { DocBlock } from '@/data/staffDocs';

// Helpers for the rich-text doc editor. Admin docs are authored as sanitized HTML (headings,
// images, embedded video) via the shared RichTextEditor; the built-in seeds use structured
// DocBlock[]. blocksToHtml lets the editor seed itself from a block-based doc if one is ever
// opened for editing, so both shapes round-trip into the same editor.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function blocksToHtml(blocks: DocBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h': return `<h2>${esc(b.text)}</h2>`;
        case 'p': return `<p>${esc(b.text)}</p>`;
        case 'ul': return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
        case 'ol': return `<ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
        case 'code': return `<pre>${esc(b.text)}</pre>`;
        case 'callout': return `<blockquote>${esc(b.text)}</blockquote>`;
      }
    })
    .join('');
}

// Rough read-time estimate from plain text (~200 wpm, min 1).
export function estimateReadMins(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
