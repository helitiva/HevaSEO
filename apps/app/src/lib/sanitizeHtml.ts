// Minimal allowlist HTML sanitizer for the note rich-text editor. Browser-only (uses DOMParser).
// We sanitize at the BOUNDARY where untrusted input enters — i.e. when a note is saved — so the
// stored HTML is already clean and the reader/card can render it directly. Seeded notes are
// author-trusted. No external dependency (DOMPurify isn't installed in this project).

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
  'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV',
  // media embeds (pasted/typed) — each is attribute-scrubbed and scheme-checked below
  'IMG', 'FIGURE', 'VIDEO', 'SOURCE', 'IFRAME',
]);
const SAFE_SCHEME = /^(https?:|mailto:)/i;
// Images: any https URL, or a base64 data-URL of a raster format (no SVG data-URLs — they can carry script).
const SAFE_IMG = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i;
const SAFE_MEDIA = /^https?:\/\//i;
// iframes are allowed ONLY for these video-embed hosts — never an arbitrary frame.
const EMBED_SRC = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\/[^"'<>\s]+$/i;
const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'SOURCE', 'IFRAME']);

const stripAttrs = (el: Element): void => [...el.attributes].forEach((a) => el.removeAttribute(a.name));

function cleanAnchorHref(el: Element): void {
  const href = el.getAttribute('href') ?? '';
  stripAttrs(el);
  if (SAFE_SCHEME.test(href.trim())) {
    el.setAttribute('href', href.trim());
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }
}

// Scrub a media element to a fixed, safe attribute set. Returns false if it was removed outright.
function cleanMedia(el: Element): boolean {
  const tag = el.tagName;
  if (tag === 'IMG') {
    const src = (el.getAttribute('src') ?? '').trim();
    const alt = el.getAttribute('alt') ?? '';
    stripAttrs(el);
    if (!SAFE_IMG.test(src)) { el.remove(); return false; }
    el.setAttribute('src', src);
    if (alt) el.setAttribute('alt', alt);
    el.setAttribute('loading', 'lazy');
    return true;
  }
  if (tag === 'VIDEO') {
    const src = (el.getAttribute('src') ?? '').trim();
    stripAttrs(el);
    el.setAttribute('controls', '');
    el.setAttribute('preload', 'metadata');
    if (src && SAFE_MEDIA.test(src)) el.setAttribute('src', src);
    return true; // <source> children are scrubbed in walk
  }
  if (tag === 'SOURCE') {
    const src = (el.getAttribute('src') ?? '').trim();
    const type = el.getAttribute('type') ?? '';
    stripAttrs(el);
    if (!SAFE_MEDIA.test(src)) { el.remove(); return false; }
    el.setAttribute('src', src);
    if (/^(video|audio)\//i.test(type)) el.setAttribute('type', type);
    return true;
  }
  if (tag === 'IFRAME') {
    const src = (el.getAttribute('src') ?? '').trim();
    stripAttrs(el);
    if (!EMBED_SRC.test(src)) { el.remove(); return false; }
    el.setAttribute('src', src);
    el.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    el.setAttribute('allowfullscreen', '');
    el.setAttribute('loading', 'lazy');
    el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    return true;
  }
  return true;
}

function walk(node: Node): void {
  // Iterate over a static copy — we mutate the tree as we go.
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) return;
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); return; }

    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // Drop disallowed wrappers but keep their (sanitized) children — except script/style.
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') { el.remove(); return; }
      walk(el);
      el.replaceWith(...[...el.childNodes]);
      return;
    }

    if (el.tagName === 'A') {
      cleanAnchorHref(el);
      walk(el);
    } else if (MEDIA_TAGS.has(el.tagName)) {
      if (cleanMedia(el)) walk(el); // VIDEO may still hold <source> children
    } else {
      stripAttrs(el);
      walk(el);
    }
  });
}

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return ''; // never called server-side in our flow
  const doc = new DOMParser().parseFromString(html, 'text/html');
  walk(doc.body);
  return doc.body.innerHTML.trim();
}

// Plain-text projection of note HTML — used for search and excerpts.
export function htmlToText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// Is there any real content (text or an embed-y element) in the HTML?
export function htmlIsEmpty(html: string): boolean {
  return htmlToText(html).length === 0 && !/<(img|video|iframe|li)\b/i.test(html);
}
