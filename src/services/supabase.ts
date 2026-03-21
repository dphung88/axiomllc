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
}) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing, skipping auto-save.');
    return;
  }

  try {
    console.log(`[Gallery] Uploading ${data.type} to Supabase Storage...`);
    const permanentUrl = await resolveToStorageUrl(data.url, data.type);
    console.log(`[Gallery] Storage upload done. Saving metadata...`);

    const { error } = await supabase
      .from('studio_gallery')
      .insert([
        {
          type: data.type,
          url: permanentUrl,
          prompt: data.prompt,
          settings: data.settings,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('Supabase DB error:', error);
      throw error;
    }
    console.log(`[Gallery] Successfully saved ${data.type} with permanent URL.`);
  } catch (error) {
    console.error('[Gallery] CRITICAL: Save failure:', error);
  }
};
