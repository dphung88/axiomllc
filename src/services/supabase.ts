import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORAGE_BUCKET = 'studio-media';

// Convert base64 data: URL to Blob
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
};

// Upload a Blob to Supabase Storage, return permanent public URL
export const uploadToStorage = async (blob: Blob, type: 'image' | 'video'): Promise<string> => {
  const ext = type === 'video'
    ? (blob.type.includes('mp4') ? 'mp4' : 'webm')
    : (blob.type.includes('png') ? 'png' : 'jpg');
  const filename = `${type}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, blob, {
      contentType: blob.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return publicUrl;
};

// Resolve URL to permanent Supabase Storage URL:
// - blob: URLs  → fetch blob → upload → return permanent URL
// - data: URLs  → convert to blob → upload → return permanent URL
// - https: URLs → upload from fetch → return permanent URL
// - already Supabase storage URLs → return as-is
const resolveToStorageUrl = async (url: string, type: 'image' | 'video'): Promise<string> => {
  // Already a permanent Supabase storage URL — no need to re-upload
  if (url.includes(supabaseUrl) && url.includes('/storage/')) return url;

  // Never store dead blob: URLs — they expire when the page closes
  if (url.startsWith('blob:')) {
    let blob: Blob;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Blob URL already expired');
      blob = await res.blob();
    } catch {
      throw new Error('[supabase] Blob URL expired before upload could complete. Cannot save to gallery.');
    }
    return await uploadToStorage(blob, type);
  }

  let blob: Blob;

  if (url.startsWith('data:')) {
    blob = dataUrlToBlob(url);
  } else {
    // https: external URL — fetch and re-upload to our storage
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
    console.log(`[Gallery] Uploading ${data.type} to Supabase Storage...`);
    permanentUrl = await resolveToStorageUrl(data.url, data.type);
    console.log(`[Gallery] Storage upload done → ${permanentUrl}`);
  } catch (storageErr: any) {
    // Storage upload failed — diagnose clearly
    console.error('[Gallery] ❌ Supabase Storage upload failed:', storageErr?.message || storageErr);
    console.error('[Gallery] → Check: bucket "studio-media" exists? Bucket is public? RLS allows insert?');

    // For images with data: URL — store directly in DB (never expires)
    if (data.url.startsWith('data:')) {
      console.warn('[Gallery] Falling back to storing data: URL directly in DB (no storage)');
      permanentUrl = data.url;
    } else {
      // For blob/https URLs that failed to upload — skip saving to avoid dead URLs in DB
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
      console.error('[Gallery] ❌ Supabase DB insert failed:', error.message, error.details, error.hint);
      throw error;
    }
    console.log(`[Gallery] ✅ Saved ${data.type} to gallery.`);
    return permanentUrl;
  } catch (dbErr: any) {
    console.error('[Gallery] ❌ DB save failure:', dbErr?.message || dbErr);
    return null;
  }
};

// Diagnostic: check if Supabase Storage bucket is accessible
// Uses list() instead of getBucket() — getBucket() is admin-only and fails with anon key
export const checkStorageBucket = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    // Step 1: Check READ — list files in bucket (needs SELECT policy)
    const { error: listError } = await supabase.storage.from(STORAGE_BUCKET).list('', { limit: 1 });
    if (listError) return { ok: false, error: `Read failed: ${listError.message}` };

    // Step 2: Check WRITE — upload a tiny test file (needs INSERT policy)
    const testBlob = new Blob(['ok'], { type: 'text/plain' });
    const testPath = `_healthcheck_${Date.now()}.txt`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(testPath, testBlob);
    if (uploadError) return { ok: false, error: `Write failed: ${uploadError.message}` };

    // Cleanup test file
    await supabase.storage.from(STORAGE_BUCKET).remove([testPath]);

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
};
