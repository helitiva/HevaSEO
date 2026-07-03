/* eslint-disable @next/next/no-img-element -- user Storage URLs, dynamic host */
'use client';

import type { MessageAttachment } from '@/data/mock';

/** Renders an order-message's image/video attachments as a thumbnail row. Media is served from our own
 *  'order-media' bucket (URLs only — no raw HTML), so there's no injection surface. */
export function MessageAttachments({ items }: { items?: MessageAttachment[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((a, i) =>
        a.kind === 'video' ? (
          <video key={i} src={a.url} controls playsInline className="max-h-40 w-40 rounded-lg border border-border object-cover" />
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name} className="block overflow-hidden rounded-lg border border-border">
            <img src={a.url} alt={a.name} className="h-24 w-24 object-cover transition hover:opacity-90" />
          </a>
        ),
      )}
    </div>
  );
}
