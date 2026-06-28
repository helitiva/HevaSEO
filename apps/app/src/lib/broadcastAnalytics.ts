import { isCritical, type Broadcast, type BroadcastAudience } from '@/data/broadcasts';
import { recipientsFor, type Recipient } from './broadcastRoster';

// Engagement analytics for a broadcast (Phase-0). Per-recipient events are generated
// deterministically (seeded by broadcast+recipient id) so the numbers are stable across
// reloads, then the demo persona's REAL interactions (the localStorage read/click/ack/dismiss
// flags the recipient portals already write) are overlaid on top — so opening a message in the
// staff portal actually moves the needle here. No backend.

export type Channel = 'inbox' | 'bell' | 'banner' | 'alert';
const CHANNELS: Channel[] = ['inbox', 'bell', 'banner', 'alert'];

export interface RecEvent extends Recipient {
  deliveredAt: number;
  readAt: number | null;
  clickedAt: number | null;
  ackedAt: number | null;
  dismissedAt: number | null;
  channel: Channel | null;
  isYou: boolean;        // the demo persona representing this audience
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── deterministic RNG ─────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUD_READ_ADJ: Record<BroadcastAudience, number> = { staff: 0.06, manager: 0.12, customer: 0, affiliate: -0.06 };

function generate(b: Broadcast, r: Recipient, now: number): RecEvent {
  const rnd = mulberry32(hashStr(`${b.id}|${r.id}`));
  const deliveredAt = new Date(b.publishAt ?? b.createdAt).getTime();
  const age = Math.max(now - deliveredAt, 0);
  const ageFactor = 1 - Math.exp(-age / (2 * DAY)); // saturates over ~2 days

  let pRead = 0.42 + 0.42 * ageFactor;
  if (b.pinned) pRead += 0.08;
  if (b.kind === 'congrats') pRead += 0.08;
  if (isCritical(b)) pRead += 0.16;
  pRead = clamp(pRead + (AUD_READ_ADJ[r.audience] ?? 0), 0.05, 0.98);

  const base: RecEvent = { ...r, deliveredAt, readAt: null, clickedAt: null, ackedAt: null, dismissedAt: null, channel: null, isYou: false };
  if (rnd() >= pRead) return base;

  // time-to-read: exponential (mean ~3h), never beyond the message's age
  const delay = Math.min(-Math.log(1 - rnd() * 0.999) * (3 * HOUR), Math.max(age - 60_000, 0));
  const readAt = deliveredAt + delay;
  const channel = CHANNELS[Math.floor(rnd() * CHANNELS.length)];

  let clickedAt: number | null = null;
  if (b.cta && rnd() < 0.42) clickedAt = Math.min(readAt + rnd() * 30 * 60_000, now);
  let ackedAt: number | null = null;
  let dismissedAt: number | null = null;
  if (b.requireAck) { if (rnd() < 0.82) ackedAt = Math.min(readAt + rnd() * HOUR, now); }
  else if (b.banner && rnd() < 0.5) dismissedAt = Math.min(readAt + rnd() * 2 * HOUR, now);

  return { ...base, readAt, clickedAt, ackedAt, dismissedAt, channel };
}

// ── real-persona overlay ──────────────────────────────────────────────────────
function readFlags(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try { const raw = localStorage.getItem(key); return new Set(raw ? (JSON.parse(raw) as string[]) : []); } catch { return new Set(); }
}

function applyOverlay(events: RecEvent[], b: Broadcast, now: number): void {
  if (typeof window === 'undefined') return;
  const seen = new Set<BroadcastAudience>();
  for (const e of events) {
    if (seen.has(e.audience)) continue; // first recipient of each audience = the demo persona ("you")
    seen.add(e.audience);
    e.isYou = true;
    const read = readFlags(`heva:broadcast:read:${e.audience}`).has(b.id);
    const acked = readFlags(`heva:broadcast:acked:${e.audience}`).has(b.id);
    const clicked = readFlags(`heva:broadcast:clicked:${e.audience}`).has(b.id);
    const dismissed = readFlags(`heva:broadcast:dismissed:${e.audience}`).has(b.id);
    if (read && e.readAt == null) { e.readAt = now; e.channel = e.channel ?? 'inbox'; }
    if (acked) { if (e.readAt == null) { e.readAt = now; e.channel = e.channel ?? 'inbox'; } e.ackedAt = e.ackedAt ?? now; }
    if (clicked) { if (e.readAt == null) { e.readAt = now; e.channel = e.channel ?? 'inbox'; } e.clickedAt = e.clickedAt ?? now; }
    if (dismissed) { if (e.readAt == null) { e.readAt = now; } e.dismissedAt = e.dismissedAt ?? now; }
  }
}

export function recipientEvents(b: Broadcast, now: number = Date.now()): RecEvent[] {
  const events = recipientsFor(b).map((r) => generate(b, r, now));
  applyOverlay(events, b, now);
  return events;
}

// ── aggregations ──────────────────────────────────────────────────────────────
export interface Summary {
  delivered: number; read: number; readRate: number;
  clicks: number; ctr: number; hasCta: boolean;
  acked: number; ackRate: number; requireAck: boolean;
  dismissed: number; avgTimeToReadMs: number | null;
}

export function summarize(events: RecEvent[], b: Broadcast): Summary {
  const delivered = events.length;
  const readEvents = events.filter((e) => e.readAt != null);
  const read = readEvents.length;
  const clicks = events.filter((e) => e.clickedAt != null).length;
  const acked = events.filter((e) => e.ackedAt != null).length;
  const dismissed = events.filter((e) => e.dismissedAt != null).length;
  const ttr = readEvents.map((e) => e.readAt! - e.deliveredAt);
  return {
    delivered, read, readRate: delivered ? read / delivered : 0,
    clicks, ctr: read ? clicks / read : 0, hasCta: Boolean(b.cta),
    acked, ackRate: delivered ? acked / delivered : 0, requireAck: Boolean(b.requireAck),
    dismissed, avgTimeToReadMs: ttr.length ? ttr.reduce((s, v) => s + v, 0) / ttr.length : null,
  };
}

// Lightweight read count for the list table (avoids materializing full aggregation per row).
export function messageReadCount(b: Broadcast, now: number = Date.now()): { read: number; total: number; clicks: number } {
  const events = recipientEvents(b, now);
  return { read: events.filter((e) => e.readAt != null).length, total: events.length, clicks: events.filter((e) => e.clickedAt != null).length };
}

export interface Bucket { label: string; count: number }
export interface TimePoint { t: number; cum: number }

// Read activity over time: hourly buckets (first 48h) + daily buckets, plus a cumulative curve.
export function readTimeline(events: RecEvent[], b: Broadcast, now: number = Date.now()): { hourly: Bucket[]; daily: Bucket[]; cumulative: TimePoint[]; total: number } {
  const start = new Date(b.publishAt ?? b.createdAt).getTime();
  const reads = events.filter((e) => e.readAt != null).map((e) => e.readAt!).sort((a, c) => a - c);
  const spanH = Math.min(48, Math.max(1, Math.ceil((now - start) / HOUR)));
  const hourly: Bucket[] = Array.from({ length: spanH }, (_, h) => ({ label: `${h}h`, count: 0 }));
  for (const t of reads) { const h = Math.floor((t - start) / HOUR); if (h >= 0 && h < spanH) hourly[h].count++; }

  const spanD = Math.min(30, Math.max(1, Math.ceil((now - start) / DAY)));
  const daily: Bucket[] = Array.from({ length: spanD }, (_, d) => ({ label: `D${d + 1}`, count: 0 }));
  for (const t of reads) { const d = Math.floor((t - start) / DAY); if (d >= 0 && d < spanD) daily[d].count++; }

  const cumulative: TimePoint[] = [{ t: start, cum: 0 }];
  let c = 0;
  for (const t of reads) { c++; cumulative.push({ t, cum: c }); }
  cumulative.push({ t: now, cum: c });
  return { hourly, daily, cumulative, total: reads.length };
}

export interface AudStat { audience: BroadcastAudience; delivered: number; read: number; rate: number; clicks: number }
export function audienceBreakdown(events: RecEvent[]): AudStat[] {
  const map = new Map<BroadcastAudience, AudStat>();
  for (const e of events) {
    const s = map.get(e.audience) ?? { audience: e.audience, delivered: 0, read: 0, rate: 0, clicks: 0 };
    s.delivered++; if (e.readAt != null) s.read++; if (e.clickedAt != null) s.clicks++;
    map.set(e.audience, s);
  }
  return [...map.values()].map((s) => ({ ...s, rate: s.delivered ? s.read / s.delivered : 0 }));
}

// Hour-of-day distribution of reads (0..23) — fuels the heatmap / "when do they read" view.
export function hourOfDayHistogram(events: RecEvent[]): number[] {
  const hist = new Array(24).fill(0) as number[];
  for (const e of events) if (e.readAt != null) hist[new Date(e.readAt).getHours()]++;
  return hist;
}

// Average read rate across a set of messages — for the "vs benchmark" comparison.
export function benchmarkReadRate(all: Broadcast[], now: number = Date.now()): number {
  const rates = all.map((b) => { const ev = recipientEvents(b, now); return ev.length ? ev.filter((e) => e.readAt != null).length / ev.length : 0; });
  return rates.length ? rates.reduce((s, v) => s + v, 0) / rates.length : 0;
}
