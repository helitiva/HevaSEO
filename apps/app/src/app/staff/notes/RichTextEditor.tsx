'use client';
import { useEffect, useRef, useState } from 'react';
import { mediaEmbedHtml, imageEmbedHtml } from '@/data/staffNotes';

// A dependency-free "classic" rich-text editor (TinyMCE/WordPress-style toolbar over a
// contentEditable surface). Uncontrolled: the DOM owns the content so the caret never jumps;
// the parent reads the latest HTML via onChange. Sanitization happens later, on save.
interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

type Cmd = { icon: string; label: string; run: (exec: ExecFn) => void; isActive?: () => boolean };
type ExecFn = (command: string, value?: string) => void;

export function RichTextEditor({ initialHtml, onChange, placeholder = 'Write your note… or paste an image / video link to embed it' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, force] = useState(0); // re-render to refresh active-button states
  const [empty, setEmpty] = useState(true);

  // Seed once on mount (uncontrolled thereafter).
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml || '';
      setEmpty(!ref.current.textContent?.trim() && !ref.current.querySelector('li,img,br'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec: ExecFn = (command, value) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  function emit() {
    const html = ref.current?.innerHTML ?? '';
    setEmpty(!ref.current?.textContent?.trim() && !ref.current?.querySelector('li,img'));
    onChange(html);
    force((n) => n + 1);
  }

  function setBlock(tag: string) {
    // Angle-bracket form is the most cross-browser reliable value for formatBlock.
    exec('formatBlock', `<${tag}>`);
  }

  function addLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    exec('createLink', url.trim());
  }

  // Insert raw HTML at the caret, then drop a fresh paragraph so typing continues below an embed.
  function insertHtml(html: string) {
    ref.current?.focus();
    document.execCommand('insertHTML', false, `${html}<p><br></p>`);
    emit();
  }

  // Paste: an image off the clipboard, or an image/video URL → embedded inline; else default paste.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const cd = e.clipboardData;
    const imgFile = Array.from(cd.files).find((f) => f.type.startsWith('image/'));
    if (imgFile) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => insertHtml(imageEmbedHtml(String(reader.result), imgFile.name));
      reader.readAsDataURL(imgFile);
      return;
    }
    const text = cd.getData('text/plain').trim();
    if (text) {
      const embed = mediaEmbedHtml(text);
      if (embed) { e.preventDefault(); insertHtml(embed); }
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => insertHtml(imageEmbedHtml(String(reader.result), file.name));
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function embedVideo() {
    const url = window.prompt('Video URL (YouTube, Vimeo, or a direct .mp4 link)');
    if (!url) return;
    const embed = mediaEmbedHtml(url.trim());
    if (embed) insertHtml(embed);
    else window.alert('That doesn’t look like a YouTube, Vimeo, or direct video link.');
  }

  const isActive = (cmd: string) => {
    try { return document.queryCommandState(cmd); } catch { return false; }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card focus-within:border-primary">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        <BlockSelect onSelect={setBlock} />
        <Sep />
        <Btn icon="ph-text-b" label="Bold" active={isActive('bold')} onClick={() => exec('bold')} />
        <Btn icon="ph-text-italic" label="Italic" active={isActive('italic')} onClick={() => exec('italic')} />
        <Btn icon="ph-text-underline" label="Underline" active={isActive('underline')} onClick={() => exec('underline')} />
        <Btn icon="ph-text-strikethrough" label="Strikethrough" active={isActive('strikeThrough')} onClick={() => exec('strikeThrough')} />
        <Sep />
        <Btn icon="ph-list-bullets" label="Bulleted list" active={isActive('insertUnorderedList')} onClick={() => exec('insertUnorderedList')} />
        <Btn icon="ph-list-numbers" label="Numbered list" active={isActive('insertOrderedList')} onClick={() => exec('insertOrderedList')} />
        <Btn icon="ph-quotes" label="Quote" onClick={() => setBlock('blockquote')} />
        <Sep />
        <Btn icon="ph-text-align-left" label="Align left" onClick={() => exec('justifyLeft')} />
        <Btn icon="ph-text-align-center" label="Align center" onClick={() => exec('justifyCenter')} />
        <Btn icon="ph-text-align-right" label="Align right" onClick={() => exec('justifyRight')} />
        <Sep />
        <Btn icon="ph-link-simple" label="Insert link" onClick={addLink} />
        <Btn icon="ph-link-break" label="Remove link" onClick={() => exec('unlink')} />
        <Sep />
        <Btn icon="ph-image" label="Insert image (upload)" onClick={() => fileRef.current?.click()} />
        <Btn icon="ph-video-camera" label="Embed video (YouTube / Vimeo / .mp4)" onClick={embedVideo} />
        <Sep />
        <Btn icon="ph-eraser" label="Clear formatting" onClick={() => exec('removeFormat')} />
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      </div>

      {/* Editable surface */}
      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          role="textbox"
          aria-multiline="true"
          aria-label="Note content"
          className="note-rte scrollbar-thin min-h-[420px] max-h-[62vh] overflow-y-auto px-4 py-3 text-[15px] leading-relaxed outline-none"
        />
      </div>
    </div>
  );
}

function Btn({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // preventDefault keeps the editor selection alive when the toolbar is clicked.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md text-base transition hover:bg-accent ${active ? 'bg-primary/15 text-primary' : 'text-foreground/80'}`}
    >
      <i className={`ph-bold ${icon}`} aria-hidden />
    </button>
  );
}

function BlockSelect({ onSelect }: { onSelect: (tag: string) => void }) {
  return (
    <select
      aria-label="Paragraph format"
      defaultValue="p"
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => { onSelect(e.target.value); e.target.value = e.target.value; }}
      className="h-8 rounded-md border border-border bg-card px-1.5 text-xs font-semibold outline-none transition hover:bg-accent"
    >
      <option value="p">Paragraph</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="blockquote">Quote</option>
    </select>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />;
}
