'use client';
import { useState } from 'react';
import { RichTextEditor } from '@/app/staff/notes/RichTextEditor';
import { sanitizeHtml, htmlIsEmpty } from '@/lib/sanitizeHtml';
import { newBroadcastId, nowIso } from '@/data/broadcastStore';
import {
  KIND_META, KINDS, AUDIENCE_META, BROADCAST_AUDIENCES,
  type Broadcast, type BroadcastAudience, type BroadcastKind,
} from '@/data/broadcasts';

// Compose / edit a broadcast, in a modal. Live preview shows the banner + inbox card the chosen
// audiences will see. Saving publishes it (or updates it) to the shared store.
export function BroadcastComposer({ editing, onSave, onClose }: {
  editing: Broadcast | null;
  onSave: (b: Broadcast) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [kind, setKind] = useState<BroadcastKind>(editing?.kind ?? 'notice');
  const [audiences, setAudiences] = useState<BroadcastAudience[]>(editing?.audiences ?? ['customer']);
  const [banner, setBanner] = useState(editing?.banner ?? true);
  const [pinned, setPinned] = useState(Boolean(editing?.pinned));
  const [ctaLabel, setCtaLabel] = useState(editing?.cta?.label ?? '');
  const [ctaHref, setCtaHref] = useState(editing?.cta?.href ?? '');
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ?? '');
  const [publishAt, setPublishAt] = useState(editing?.publishAt ?? '');
  const [requireAck, setRequireAck] = useState(Boolean(editing?.requireAck));
  const [useArticle, setUseArticle] = useState(Boolean(editing?.article));
  const [articleHtml, setArticleHtml] = useState(editing?.article ?? '');

  const toggleAud = (a: BroadcastAudience) => setAudiences((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  const everyone = audiences.length === BROADCAST_AUDIENCES.length;
  const m = KIND_META[kind];
  const canSave = title.trim().length > 0 && body.trim().length > 0 && audiences.length > 0;
  const scheduled = Boolean(publishAt) && new Date(publishAt).getTime() > Date.now();

  const save = () => {
    if (!canSave) return;
    const b: Broadcast = {
      id: editing?.id ?? newBroadcastId(),
      title: title.trim(), body: body.trim(), kind, audiences, banner, pinned,
      requireAck,
      article: useArticle && !htmlIsEmpty(articleHtml) ? sanitizeHtml(articleHtml) : undefined,
      cta: ctaLabel.trim() && ctaHref.trim() ? { label: ctaLabel.trim(), href: ctaHref.trim() } : null,
      createdAt: editing?.createdAt ?? nowIso(),
      publishAt: publishAt || null,
      expiresAt: expiresAt || null,
      active: editing?.active ?? true,
    };
    onSave(b);
  };

  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative grid max-h-[90vh] w-full max-w-3xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="display text-base font-bold">{editing ? 'Edit message' : 'New message'}</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>

        <div className="scrollbar-thin space-y-4 overflow-y-auto px-5 py-4">
          {/* kind */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => { const km = KIND_META[k]; const on = kind === k; return (
                <button key={k} type="button" onClick={() => setKind(k)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`} style={on ? { background: km.color, borderColor: km.color } : undefined}>
                  <i className={`ph-bold ${km.icon}`} aria-hidden /> {km.label}
                </button>
              ); })}
            </div>
          </div>

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Scheduled maintenance this Sunday" className={`${inp} text-base font-semibold`} autoFocus />
          <div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={useArticle ? 'Short summary — shown collapsed, in the bell & banner' : 'Message body…'} className={`${inp} resize-y`} />
            <label className="mt-1.5 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useArticle} onChange={(e) => setUseArticle(e.target.checked)} className="accent-primary" />
              <span>Add a long-form article <span className="text-muted-foreground">(readers expand the message to read it)</span></span>
            </label>
          </div>
          {useArticle && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Article — headings, images &amp; video</label>
              <RichTextEditor initialHtml={articleHtml} onChange={setArticleHtml} placeholder="Write the full article… add headings, an image, or embed a video." />
            </div>
          )}

          {/* audiences */}
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Send to</span>
              <button type="button" onClick={() => setAudiences(everyone ? [] : [...BROADCAST_AUDIENCES])} className="font-semibold normal-case text-primary hover:underline">{everyone ? 'Clear' : 'Everyone'}</button>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BROADCAST_AUDIENCES.map((a) => { const am = AUDIENCE_META[a]; const on = audiences.includes(a); return (
                <button key={a} type="button" onClick={() => toggleAud(a)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`} style={on ? { background: am.color, borderColor: am.color } : undefined}>
                  <i className={`ph-bold ${on ? 'ph-check-circle' : am.icon}`} aria-hidden /> {am.label}
                </button>
              ); })}
            </div>
          </div>

          {/* options */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" checked={banner} onChange={(e) => setBanner(e.target.checked)} className="accent-primary" />
              <span className="flex-1">Show as overview banner</span><i className="ph-bold ph-flag-banner text-muted-foreground" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary" />
              <span className="flex-1">Pin to top</span><i className="ph-bold ph-push-pin text-muted-foreground" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} className="accent-primary" />
              <span className="flex-1">Require acknowledgement <span className="text-muted-foreground">— readers must confirm; can&apos;t just dismiss</span></span><i className="ph-bold ph-seal-check text-muted-foreground" />
            </label>
          </div>

          {/* schedule + cta + expiry */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule send <span className="font-normal normal-case">(optional)</span></label><input type="datetime-local" value={publishAt ?? ''} onChange={(e) => setPublishAt(e.target.value)} className={inp} /></div>
            <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expires <span className="font-normal normal-case">(optional)</span></label><input type="date" value={expiresAt ?? ''} onChange={(e) => setExpiresAt(e.target.value)} className={inp} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">CTA label <span className="font-normal normal-case">(optional)</span></label><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Read more" className={inp} /></div>
            <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">CTA link</label><input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/docs" className={inp} /></div>
          </div>

          {/* preview */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className={`overflow-hidden rounded-2xl border bg-gradient-to-r p-4 ${m.bannerClass}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}22`, color: m.color }}><i className={`ph-fill ${m.icon} text-xl`} aria-hidden /></span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">{title || 'Message title'}{m.celebratory && <i className="ph-fill ph-sparkle text-amber-400" />}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{body || 'Your message body will appear here.'}</p>
                  {ctaLabel && ctaHref && <span className="mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: m.color }}>{ctaLabel} <i className="ph-bold ph-arrow-right" /></span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={!canSave} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 disabled:opacity-40">
            <i className={`ph-bold ${scheduled ? 'ph-clock' : 'ph-paper-plane-tilt'}`} /> {editing ? 'Save changes' : scheduled ? 'Schedule' : 'Send message'}
          </button>
        </div>
      </div>
    </div>
  );
}
