import { getSupabase } from '@/lib/supabase';

const BUCKET = 'media';

export async function uploadMediaFile(userId: string, file: File) {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const sb = getSupabase();

  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  const publicUrl = signed?.signedUrl ?? '';

  return { path, publicUrl };
}

export async function refreshSignedUrl(path: string) {
  const { data } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl;
}

export async function uploadDataUrl(userId: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
  return uploadMediaFile(userId, file);
}
