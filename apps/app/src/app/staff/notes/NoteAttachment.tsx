'use client';
import { useState } from 'react';
import { youtubeId, youtubeEmbed, youtubeThumb, linkHost, type NoteAttachment } from '@/data/staffNotes';

// Renders one note attachment: an image, a YouTube video (thumbnail → inline embed on click),
// or a link chip. Shared between the note card preview and the full reader.
export function Attachment({ att }: { att: NoteAttachment }) {
  const [playing, setPlaying] = useState(false);

  if (att.kind === 'image') {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={att.url} alt={att.label || 'Note image'} loading="lazy" className="max-h-80 w-full object-cover transition hover:opacity-90" />
      </a>
    );
  }

  if (att.kind === 'video') {
    const id = youtubeId(att.url);
    if (!id) return <LinkChip att={att} />;
    if (playing) {
      return (
        <div className="aspect-video overflow-hidden rounded-lg border border-border">
          <iframe
            src={`${youtubeEmbed(id)}?autoplay=1`}
            title={att.label || 'YouTube video'}
            allow="accelerated-display; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      );
    }
    return (
      <button onClick={() => setPlaying(true)} className="relative block w-full overflow-hidden rounded-lg border border-border" aria-label={`Play ${att.label || 'video'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={youtubeThumb(id)} alt={att.label || 'Video thumbnail'} loading="lazy" className="aspect-video w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/10 transition hover:bg-black/20">
          <i className="ph-fill ph-play-circle text-5xl text-white drop-shadow-lg" aria-hidden />
        </span>
        {att.label && <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs font-medium text-white">{att.label}</span>}
      </button>
    );
  }

  return <LinkChip att={att} />;
}

function LinkChip({ att }: { att: NoteAttachment }) {
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs transition hover:border-primary/40"
    >
      <i className="ph-bold ph-link-simple text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">{att.label || linkHost(att.url)}</span>
      <span className="shrink-0 text-muted-foreground">{linkHost(att.url)}</span>
      <i className="ph-bold ph-arrow-up-right shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}
