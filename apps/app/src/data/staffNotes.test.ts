import { describe, it, expect } from 'vitest';
import { mediaEmbedHtml, imageEmbedHtml, youtubeId, vimeoId } from './staffNotes';

describe('mediaEmbedHtml', () => {
  it('embeds a YouTube watch URL as a nocookie iframe', () => {
    const html = mediaEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(html).toContain('<iframe');
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
  it('embeds a youtu.be short link', () => {
    expect(mediaEmbedHtml('https://youtu.be/dQw4w9WgXcQ')).toContain('embed/dQw4w9WgXcQ');
  });
  it('embeds a Vimeo URL as a player iframe', () => {
    expect(mediaEmbedHtml('https://vimeo.com/76979871')).toContain('player.vimeo.com/video/76979871');
  });
  it('embeds a direct video file as a <video> element', () => {
    const html = mediaEmbedHtml('https://cdn.example.com/clip.mp4');
    expect(html).toContain('<video controls');
    expect(html).toContain('clip.mp4');
  });
  it('embeds an image URL as an <img>', () => {
    expect(mediaEmbedHtml('https://cdn.example.com/pic.png')).toBe('<img src="https://cdn.example.com/pic.png" alt="" />');
  });
  it('returns null for a non-media URL', () => {
    expect(mediaEmbedHtml('https://example.com/article')).toBeNull();
  });
  it('returns null for a non-http string', () => {
    expect(mediaEmbedHtml('just some text')).toBeNull();
    expect(mediaEmbedHtml('javascript:alert(1)')).toBeNull();
  });
  it('escapes quotes/angle brackets when building an image tag', () => {
    expect(imageEmbedHtml('data:image/png;base64,AAA"', 'a"b')).toBe('<img src="data:image/png;base64,AAA%22" alt="a%22b" />');
  });
});

describe('id extractors', () => {
  it('pulls a YouTube id from several URL shapes', () => {
    expect(youtubeId('https://youtu.be/abc123XYZ_-')).toBe('abc123XYZ_-');
    expect(youtubeId('https://www.youtube.com/watch?v=abc123XYZ_-')).toBe('abc123XYZ_-');
    expect(youtubeId('https://example.com')).toBeNull();
  });
  it('pulls a Vimeo numeric id', () => {
    expect(vimeoId('https://vimeo.com/video/123456')).toBe('123456');
    expect(vimeoId('https://vimeo.com/nope')).toBeNull();
  });
});
