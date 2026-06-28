'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BROADCAST_SEEDS, isLive, isCritical, type Broadcast, type BroadcastAudience } from './broadcasts';

// Editable broadcast store (Phase-0 mock). Built-in seeds + admin-created/edited messages in
// localStorage, merged: a created message with a seed's id overrides it; a tombstone hides a
// deleted seed. Per-audience read + dismissed-banner state lives under its own keys so each
// recipient surface tracks what's been seen. One global message store (admin writes, every
// audience reads), same-origin — like the docs store.
const KEY = 'heva:broadcasts:v1';
const HIDDEN_KEY = 'heva:broadcasts:hidden:v1';
const EVT = 'heva:broadcasts-changed';
const ACTIVITY_KEY = 'heva:broadcasts:activity:v1';
const readKey = (a: BroadcastAudience) => `heva:broadcast:read:${a}`;
const dismissKey = (a: BroadcastAudience) => `heva:broadcast:dismissed:${a}`;
const ackKey = (a: BroadcastAudience) => `heva:broadcast:acked:${a}`;
const clickKey = (a: BroadcastAudience) => `heva:broadcast:clicked:${a}`;

// Record that this audience's persona clicked a broadcast's CTA — feeds the click analytics.
// (Reading it counts as reading too.) Call from CTA onClick in the recipient surfaces.
export function markBroadcastClicked(aud: BroadcastAudience, id: string): void {
  const c = readJson<string[]>(clickKey(aud), []); if (!c.includes(id)) writeJson(clickKey(aud), [...c, id]);
  const r = readJson<string[]>(readKey(aud), []); if (!r.includes(id)) writeJson(readKey(aud), [...r, id]);
}

export interface BroadcastActivity { at: string; action: string; title: string; icon: string }
function logActivity(action: string, title: string, icon: string): void {
  const list = readJson<BroadcastActivity[]>(ACTIVITY_KEY, []);
  writeJson(ACTIVITY_KEY, [{ at: new Date().toISOString(), action, title, icon }, ...list].slice(0, 40));
}

const SEEDS: Broadcast[] = BROADCAST_SEEDS.map((b) => ({ ...b, system: true }));
const SEED_IDS = new Set(SEEDS.map((b) => b.id));

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function newBroadcastId(): string { return `bc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }
export function nowIso(): string { return new Date().toISOString(); }
export function isSeedBroadcast(id: string): boolean { return SEED_IDS.has(id); }

function mergeAll(created: Broadcast[], hidden: string[]): Broadcast[] {
  const createdIds = new Set(created.map((b) => b.id));
  const seeds = SEEDS.filter((s) => !createdIds.has(s.id) && !hidden.includes(s.id));
  return [...created, ...seeds].sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt.localeCompare(a.createdAt));
}

// ── Admin: full management ────────────────────────────────────────────────────
export function useBroadcasts() {
  const [created, setCreated] = useState<Broadcast[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => { setCreated(readJson<Broadcast[]>(KEY, [])); setHidden(readJson<string[]>(HIDDEN_KEY, [])); };
    load(); setReady(true);
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);

  const saveBroadcast = useCallback((b: Broadcast, logAs?: string) => {
    const list = readJson<Broadcast[]>(KEY, []);
    const existed = list.some((x) => x.id === b.id) || SEED_IDS.has(b.id);
    const entry = { ...b, system: false, updatedAt: existed ? new Date().toISOString() : b.updatedAt };
    const i = list.findIndex((x) => x.id === b.id);
    const next = i >= 0 ? list.map((x, n) => (n === i ? entry : x)) : [entry, ...list];
    writeJson(KEY, next); setCreated(next);
    if (SEED_IDS.has(b.id)) { const h = readJson<string[]>(HIDDEN_KEY, []).filter((x) => x !== b.id); writeJson(HIDDEN_KEY, h); setHidden(h); }
    logActivity(logAs ?? (existed ? 'Edited' : 'Sent'), b.title, existed ? 'ph-pencil-simple' : 'ph-paper-plane-tilt');
  }, []);
  const setActive = useCallback((id: string, active: boolean) => {
    const cur = mergeAll(readJson<Broadcast[]>(KEY, []), readJson<string[]>(HIDDEN_KEY, [])).find((b) => b.id === id);
    if (cur) { saveBroadcast({ ...cur, active }, active ? 'Restored' : 'Recalled'); }
  }, [saveBroadcast]);
  const removeBroadcast = useCallback((id: string) => {
    const cur = mergeAll(readJson<Broadcast[]>(KEY, []), readJson<string[]>(HIDDEN_KEY, [])).find((b) => b.id === id);
    const next = readJson<Broadcast[]>(KEY, []).filter((b) => b.id !== id);
    writeJson(KEY, next); setCreated(next);
    if (SEED_IDS.has(id)) { const h = readJson<string[]>(HIDDEN_KEY, []); if (!h.includes(id)) { const u = [...h, id]; writeJson(HIDDEN_KEY, u); setHidden(u); } }
    if (cur) logActivity('Deleted', cur.title, 'ph-trash');
  }, []);

  return { all: mergeAll(created, hidden), created, ready, saveBroadcast, setActive, removeBroadcast, isSeed: isSeedBroadcast };
}

// Per-audience reach/read/ack snapshot for a message (Phase-0: each audience is one persona).
export interface BroadcastStat { audience: BroadcastAudience; read: boolean; dismissed: boolean; acked: boolean }
export function broadcastStats(b: Broadcast): BroadcastStat[] {
  return b.audiences.map((a) => ({
    audience: a,
    read: readJson<string[]>(readKey(a), []).includes(b.id),
    dismissed: readJson<string[]>(dismissKey(a), []).includes(b.id),
    acked: readJson<string[]>(ackKey(a), []).includes(b.id),
  }));
}

// Admin activity feed (sent / edited / recalled / deleted).
export function useBroadcastActivity() {
  const [items, setItems] = useState<BroadcastActivity[]>([]);
  useEffect(() => {
    const load = () => setItems(readJson<BroadcastActivity[]>(ACTIVITY_KEY, []));
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  return items;
}

// Shared: live messages an audience should see, newest/pinned first.
function liveForAudience(created: Broadcast[], hidden: string[], aud: BroadcastAudience): Broadcast[] {
  const now = new Date();
  return mergeAll(created, hidden).filter((b) => isLive(b, now) && b.audiences.includes(aud));
}

function useStoreState() {
  const [created, setCreated] = useState<Broadcast[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => { setCreated(readJson<Broadcast[]>(KEY, [])); setHidden(readJson<string[]>(HIDDEN_KEY, [])); };
    load(); setReady(true);
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  return { created, hidden, ready };
}

// ── Recipient: inbox (read state) ─────────────────────────────────────────────
export function useInbox(aud: BroadcastAudience) {
  const { created, hidden, ready } = useStoreState();
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    const load = () => setRead(readJson<string[]>(readKey(aud), []));
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, [aud]);

  const items = useMemo(() => liveForAudience(created, hidden, aud), [created, hidden, aud]);
  const readSet = useMemo(() => new Set(read), [read]);
  const unread = items.filter((b) => !readSet.has(b.id)).length;

  const markRead = useCallback((id: string) => {
    const cur = readJson<string[]>(readKey(aud), []);
    if (!cur.includes(id)) { const next = [...cur, id]; writeJson(readKey(aud), next); setRead(next); }
  }, [aud]);
  const markAllRead = useCallback(() => {
    const ids = liveForAudience(readJson<Broadcast[]>(KEY, []), readJson<string[]>(HIDDEN_KEY, []), aud).map((b) => b.id);
    writeJson(readKey(aud), ids); setRead(ids);
  }, [aud]);
  const markUnread = useCallback((id: string) => {
    const next = readJson<string[]>(readKey(aud), []).filter((x) => x !== id);
    writeJson(readKey(aud), next); setRead(next);
  }, [aud]);

  return { items, unread, ready, isRead: (id: string) => readSet.has(id), markRead, markAllRead, markUnread };
}

// Shared dismiss/ack state hook for the banner + site-alert surfaces.
function useDismissAck(aud: BroadcastAudience) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [acked, setAcked] = useState<string[]>([]);
  useEffect(() => {
    const load = () => { setDismissed(readJson<string[]>(dismissKey(aud), [])); setAcked(readJson<string[]>(ackKey(aud), [])); };
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, [aud]);
  const dismiss = useCallback((id: string) => {
    const cur = readJson<string[]>(dismissKey(aud), []);
    if (!cur.includes(id)) { const next = [...cur, id]; writeJson(dismissKey(aud), next); setDismissed(next); }
  }, [aud]);
  const acknowledge = useCallback((id: string) => {
    const a = readJson<string[]>(ackKey(aud), []); if (!a.includes(id)) { const na = [...a, id]; writeJson(ackKey(aud), na); setAcked(na); }
    const d = readJson<string[]>(dismissKey(aud), []); if (!d.includes(id)) { const nd = [...d, id]; writeJson(dismissKey(aud), nd); setDismissed(nd); }
    const r = readJson<string[]>(readKey(aud), []); if (!r.includes(id)) writeJson(readKey(aud), [...r, id]);
  }, [aud]);
  return { dismissed, acked, dismiss, acknowledge };
}

// ── Recipient: overview banners (non-critical, banner-flagged) ─────────────────
export function useBanners(aud: BroadcastAudience) {
  const { created, hidden } = useStoreState();
  const { dismissed, dismiss, acknowledge } = useDismissAck(aud);
  const banners = useMemo(
    () => liveForAudience(created, hidden, aud).filter((b) => b.banner && !isCritical(b) && !dismissed.includes(b.id)),
    [created, hidden, aud, dismissed],
  );
  return { banners, dismiss, acknowledge };
}

// ── Recipient: site-wide alert bar (critical kinds, every page) ────────────────
export function useSiteAlerts(aud: BroadcastAudience) {
  const { created, hidden } = useStoreState();
  const { dismissed, dismiss, acknowledge } = useDismissAck(aud);
  const alerts = useMemo(
    () => liveForAudience(created, hidden, aud).filter((b) => isCritical(b) && !dismissed.includes(b.id)),
    [created, hidden, aud, dismissed],
  );
  return { alerts, dismiss, acknowledge };
}
