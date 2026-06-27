// Personal notebook — each staffer's OWN private notes. Not customer-facing, not the per-task
// self-note log. Supports rich attachments (image, link, YouTube video), free-form labels, and a
// single category for grouping. Phase 0: seeded mock + client-side CRUD (no backend yet).

export type NoteAttachmentKind = 'image' | 'video' | 'link';
export interface NoteAttachment {
  id: string;
  kind: NoteAttachmentKind;
  url: string;
  label?: string;
}

export interface StaffNote {
  id: string;
  title: string;
  body: string; // sanitized rich-text HTML (see lib/sanitizeHtml)
  category: string;
  labels: string[];
  attachments: NoteAttachment[];
  color: NoteColor;
  pinned: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

// A small fixed palette so notes feel personal without becoming a colour free-for-all.
export type NoteColor = 'default' | 'amber' | 'sky' | 'emerald' | 'violet' | 'rose';
export const NOTE_COLORS: Record<NoteColor, { label: string; dot: string; ring: string; tint: string }> = {
  default: { label: 'Default', dot: '#94a3b8', ring: 'hsl(var(--border))', tint: 'transparent' },
  amber: { label: 'Amber', dot: '#f59e0b', ring: '#f59e0b66', tint: '#f59e0b14' },
  sky: { label: 'Sky', dot: '#0ea5e9', ring: '#0ea5e966', tint: '#0ea5e914' },
  emerald: { label: 'Emerald', dot: '#10b981', ring: '#10b98166', tint: '#10b98114' },
  violet: { label: 'Violet', dot: '#8b5cf6', ring: '#8b5cf666', tint: '#8b5cf614' },
  rose: { label: 'Rose', dot: '#f43f5e', ring: '#f43f5e66', tint: '#f43f5e14' },
};

// Starter categories — staff can also type a new one in the composer.
export const NOTE_CATEGORIES = ['Workflow', 'Snippets', 'Research', 'Ideas', 'Reference', 'Personal'];

// ── YouTube helpers ─────────────────────────────────────────────────────────
// Extract a video id from the common URL shapes (watch, youtu.be, embed, shorts).
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const isYoutube = (url: string): boolean => youtubeId(url) !== null;

export function vimeoId(url: string): string | null {
  const m = url.trim().match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}
export const vimeoEmbed = (id: string) => `https://player.vimeo.com/video/${id}`;

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?[^\s]*)?$/i;
const VID_EXT = /\.(mp4|webm|ogg|mov)(\?[^\s]*)?$/i;
const esc = (s: string) => s.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');

// Turn a pasted/typed media URL into inline HTML the editor embeds in place. Returns null for a
// non-media URL (caller falls back to default paste / the link button). The stored result is still
// re-validated by sanitizeHtml on save — this is the convenience layer, not the security boundary.
export function mediaEmbedHtml(raw: string): string | null {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const yt = youtubeId(url);
  if (yt) return `<iframe src="${youtubeEmbed(yt)}" allowfullscreen></iframe>`;
  const vm = vimeoId(url);
  if (vm) return `<iframe src="${vimeoEmbed(vm)}" allowfullscreen></iframe>`;
  if (VID_EXT.test(url)) return `<video controls src="${esc(url)}"></video>`;
  if (IMG_EXT.test(url)) return `<img src="${esc(url)}" alt="" />`;
  return null;
}
export const imageEmbedHtml = (src: string, alt = ''): string => `<img src="${esc(src)}" alt="${esc(alt)}" />`;

// A readable hostname for a plain link chip (best-effort).
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const now = '2026-06-27T09:00:00';
// ── Seed notes ──────────────────────────────────────────────────────────────
export const SEED_NOTES: StaffNote[] = [
  {
    id: 'note-1', title: 'Internal-link checklist (my version)',
    body: '<p>Before submitting any article:</p><ul><li>2–3 contextual internal links</li><li>link to the relevant money page</li><li>descriptive anchor, not “click here”</li><li>check the target page actually exists</li></ul>',
    category: 'Workflow', labels: ['content', 'qa'], color: 'emerald', pinned: true,
    attachments: [{ id: 'a1', kind: 'link', url: 'https://docs.google.com/document/d/my-onpage-notes', label: 'My on-page notes' }],
    createdAt: '2026-06-20T10:00:00', updatedAt: '2026-06-24T14:30:00',
  },
  {
    id: 'note-2', title: 'Meta description that converted well',
    body: '<p>Saved this one — got a <strong>9% CTR</strong> on the /pricing cluster. Reuse the structure: <em>promise → proof → soft CTA</em>.</p>',
    category: 'Snippets', labels: ['content', 'meta', 'win'], color: 'amber', pinned: true,
    attachments: [],
    createdAt: '2026-06-18T08:15:00', updatedAt: '2026-06-18T08:15:00',
  },
  {
    id: 'note-3', title: 'Core Web Vitals explainer (rewatch)',
    body: '<p>Great breakdown of LCP/CLS/INP fixes. The part on font preloading at <strong>~6:30</strong> is the bit I keep forgetting.</p><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe><p>Paste any YouTube / Vimeo / image link straight into the editor and it embeds like this.</p>',
    category: 'Reference', labels: ['optimize', 'performance'], color: 'sky', pinned: false,
    attachments: [{ id: 'a2', kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'CWV deep dive' }],
    createdAt: '2026-06-15T16:40:00', updatedAt: '2026-06-15T16:40:00',
  },
  {
    id: 'note-4', title: 'Outline idea: "SEO for SaaS" cluster',
    body: '<p>Pillar + 6 supporting articles. <em>Map intent before pitching</em> to the client. Competitor gap = no comparison content.</p>',
    category: 'Ideas', labels: ['content', 'strategy'], color: 'violet', pinned: false,
    attachments: [],
    createdAt: '2026-06-12T11:20:00', updatedAt: '2026-06-22T09:05:00',
  },
  {
    id: 'note-5', title: 'Screenshot — preferred article structure',
    body: '<p>The layout Ken approved last sprint. Use this as the default skeleton.</p>',
    category: 'Reference', labels: ['content', 'template'], color: 'default', pinned: false,
    attachments: [{ id: 'a3', kind: 'image', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=70', label: 'Article skeleton' }],
    createdAt: '2026-06-08T13:00:00', updatedAt: '2026-06-08T13:00:00',
  },
];

export const newNoteId = (): string => `note-${Date.now()}`;
export const newAttachmentId = (): string => `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const nowIso = (): string => new Date().toISOString();

// Human-friendly relative-ish date for note cards.
export function fmtNoteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
