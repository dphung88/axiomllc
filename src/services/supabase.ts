import { createClient } from '@supabase/supabase-js';
import { getSupabaseEdgeHeaders } from './apiConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const r2PublicUrl = (import.meta.env.VITE_R2_PUBLIC_URL || '').replace(/\/$/, '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const edgeUrl = () => supabaseUrl ? `${supabaseUrl}/functions/v1` : '';

// Convert base64 data: URL to Blob
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
};

// Upload a Blob to Cloudflare R2 via Edge Function, return permanent public URL
export const uploadToStorage = async (blob: Blob, type: 'image' | 'video'): Promise<string> => {
  const base = edgeUrl();
  if (!base) throw new Error('VITE_SUPABASE_URL not configured');

  const ext = type === 'video'
    ? (blob.type.includes('mp4') ? 'mp4' : 'webm')
    : (blob.type.includes('png') ? 'png' : 'jpg');

  const res = await fetch(`${base}/r2-upload?type=${type}&ext=${ext}`, {
    method: 'POST',
    body: blob,
    headers: {
      ...getSupabaseEdgeHeaders(),
      'Content-Type': blob.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `R2 upload failed: ${res.status}`);
  }

  const { url } = await res.json();
  return url;
};

// Resolve any URL to a permanent R2 storage URL
const resolveToStorageUrl = async (url: string, type: 'image' | 'video'): Promise<string> => {
  // Already a permanent R2 URL (check both configured URL and generic r2.dev domain)
  if (r2PublicUrl && url.startsWith(r2PublicUrl)) return url;
  if (url.includes('.r2.dev/') || url.includes('.r2.cloudflarestorage.com/')) return url;
  // Backward compat: already a Supabase storage URL
  if (url.includes(supabaseUrl) && url.includes('/storage/')) return url;

  if (url.startsWith('blob:')) {
    let blob: Blob;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Blob URL already expired');
      blob = await res.blob();
    } catch {
      throw new Error('[storage] Blob URL expired before upload could complete. Cannot save to gallery.');
    }
    return await uploadToStorage(blob, type);
  }

  let blob: Blob;
  if (url.startsWith('data:')) {
    blob = dataUrlToBlob(url);
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    blob = await res.blob();
  }
  return await uploadToStorage(blob, type);
};

export const saveToStudioGallery = async (data: {
  type: 'image' | 'video';
  url: string;
  prompt: string;
  settings?: any;
}): Promise<string | null> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Gallery] Supabase credentials missing, skipping auto-save.');
    return null;
  }

  let permanentUrl: string;

  try {
    console.log(`[Gallery] Uploading ${data.type} to R2...`);
    permanentUrl = await resolveToStorageUrl(data.url, data.type);
    console.log(`[Gallery] R2 upload done → ${permanentUrl}`);
  } catch (storageErr: any) {
    console.error('[Gallery] ❌ R2 upload failed:', storageErr?.message || storageErr);

    if (data.url.startsWith('data:')) {
      console.warn('[Gallery] Falling back to storing data: URL directly in DB');
      permanentUrl = data.url;
    } else {
      console.error('[Gallery] Cannot save video with temporary URL. Skipping gallery save.');
      return null;
    }
  }

  try {
    const { error } = await supabase
      .from('studio_gallery')
      .insert([{
        type: data.type,
        url: permanentUrl,
        prompt: data.prompt,
        settings: data.settings,
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      console.error('[Gallery] ❌ DB insert failed:', error.message);
      throw error;
    }
    console.log(`[Gallery] ✅ Saved ${data.type} to gallery.`);
    return permanentUrl;
  } catch (dbErr: any) {
    console.error('[Gallery] ❌ DB save failure:', dbErr?.message || dbErr);
    return null;
  }
};

// Diagnostic: check if R2 upload is working
export const checkStorageBucket = async (): Promise<{ ok: boolean; error?: string }> => {
  const base = edgeUrl();
  if (!base) return { ok: false, error: 'VITE_SUPABASE_URL not configured' };
  try {
    const testBlob = new Blob(['ok'], { type: 'text/plain' });
    const res = await fetch(`${base}/r2-upload?type=image&ext=txt`, {
      method: 'POST',
      body: testBlob,
      headers: { ...getSupabaseEdgeHeaders(), 'Content-Type': 'text/plain' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as any).error || `R2 check failed: ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
};
