import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const { error } = await supabase
      .from('studio_gallery')
      .insert([
        {
          type: data.type,
          url: data.url,
          prompt: data.prompt,
          settings: data.settings,
          created_at: new Date().toISOString(),
        },
      ]);
    if (error) throw error;
    console.log(`Successfully saved ${data.type} to Supabase`);
  } catch (error) {
    console.error('Supabase save error:', error);
  }
};
