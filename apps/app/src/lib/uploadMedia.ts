'use client';
import { createClient } from '@/lib/supabase/client';
import type { MessageAttachment } from '@/data/mock';

// Shared client-side media upload for message composers (ticket replies, order revisions). Uploads to the
// public 'order-media' bucket under the user's own uid folder and returns the attachment descriptor.
export const MEDIA_MAX = 30 * 1024 * 1024; // 30 MB
export const isMediaFile = (type: string) => type.startsWith('image/') || type.startsWith('video/');

export async function uploadMedia(file: File): Promise<MessageAttachment | null> {
  if (!isMediaFile(file.type) || file.size > MEDIA_MAX) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${user.id}/msg-${Date.now()}-${Math.round(Math.random() * 1e4)}.${ext}`;
  const up = await supabase.storage.from('order-media').upload(path, file, { contentType: file.type });
  if (up.error) return null;
  const { data: { publicUrl } } = supabase.storage.from('order-media').getPublicUrl(path);
  return { kind: file.type.startsWith('video/') ? 'video' : 'image', url: publicUrl, name: file.name };
}

// A general file upload for deliverables (PDF/DOCX/ZIP/… — not just media). Same public 'order-media'
// bucket + own-uid folder; returns a {kind:'file', fileName, url} descriptor the deliverable row stores.
export const FILE_MAX = 30 * 1024 * 1024; // 30 MB
export type UploadedDeliverable = { kind: 'file'; fileName: string; url: string };
export async function uploadDeliverableFile(file: File): Promise<UploadedDeliverable | null> {
  if (file.size > FILE_MAX) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${user.id}/deliv-${Date.now()}-${Math.round(Math.random() * 1e4)}.${ext}`;
  // dedicated 'deliverables' bucket accepts any file type (order-media is media-only)
  const up = await supabase.storage.from('deliverables').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (up.error) return null;
  const { data: { publicUrl } } = supabase.storage.from('deliverables').getPublicUrl(path);
  return { kind: 'file', fileName: file.name, url: publicUrl };
}
