'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BROADCAST_SEEDS, isLive, type Broadcast, type BroadcastAudience } from './broadcasts';

// Editable broadcast store (Phase-0 mock). Built-in seeds + admin-created/edited messages in
// localStorage, merged: a created message with a seed's id overrides it; a tombstone hides a
// deleted seed. Per-audience read + dismissed-banner state lives under its own keys so each
// recipient surface tracks what's been seen. One global message store (admin writes, every
// audience reads), same-origin — like the docs store.
const KEY = 'heva:broadcasts:v1';
const HIDDEN_KEY = 'heva:broadcasts:hidden:v1';
const EVT = 'heva:broadcasts-changed';
const readKey = (a: BroadcastAudience) => `heva:broadcast:read:${a}`;
const dismissKey = (a: BroadcastAudience) => `heva:broadcast:dismissed:${a}`;

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

  const saveBroadcast = useCallback((b: Broadcast) => {
    const list = readJson<Broadcast[]>(KEY, []);
    const entry = { ...b, system: false };
    const i = list.findIndex((x) => x.id === b.id);
    const next = i >= 0 ? list.map((x, n) => (n === i ? entry : x)) : [entry, ...list];
    writeJson(KEY, next); setCreated(next);
    if (SEED_IDS.has(b.id)) { const h = readJson<string[]>(HIDDEN_KEY, []).filter((x) => x !== b.id); writeJson(HIDDEN_KEY, h); setHidden(h); }
  }, []);
  const setActive = useCallback((id: string, active: boolean) => {
    const cur = mergeAll(readJson<Broadcast[]>(KEY, []), readJson<string[]>(HIDDEN_KEY, [])).find((b) => b.id === id);
    if (cur) saveBroadcast({ ...cur, active });
  }, [saveBroadcast]);
  const removeBroadcast = useCallback((id: string) => {
    const next = readJson<Broadcast[]>(KEY, []).filter((b) => b.id !== id);
    writeJson(KEY, next); setCreated(next);
    if (SEED_IDS.has(id)) { const h = readJson<string[]>(HIDDEN_KEY, []); if (!h.includes(id)) { const u = [...h, id]; writeJson(HIDDEN_KEY, u); setHidden(u); } }
  }, []);

  return { all: mergeAll(created, hidden), created, ready, saveBroadcast, setActive, removeBroadcast, isSeed: isSeedBroadcast };
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

  return { items, unread, ready, isRead: (id: string) => readSet.has(id), markRead, markAllRead };
}

// ── Recipient: overview banners (dismiss state) ───────────────────────────────
export function useBanners(aud: BroadcastAudience) {
  const { created, hidden } = useStoreState();
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    const load = () => setDismissed(readJson<string[]>(dismissKey(aud), []));
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, [aud]);

  const banners = useMemo(
    () => liveForAudience(created, hidden, aud).filter((b) => b.banner && !dismissed.includes(b.id)),
    [created, hidden, aud, dismissed],
  );
  const dismiss = useCallback((id: string) => {
    const cur = readJson<string[]>(dismissKey(aud), []);
    if (!cur.includes(id)) { const next = [...cur, id]; writeJson(dismissKey(aud), next); setDismissed(next); }
  }, [aud]);

  return { banners, dismiss };
}
