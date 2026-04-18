
function getSettings(): Record<string, any> {
  const saved = localStorage.getItem('studioSettings');
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return {};
}

export const getProvider = (): 'google' | 'bytedance' => {
  return getSettings().provider ?? 'google';
};

export const getLlmModel = () => {
  const s = getSettings();
  if (s.provider === 'bytedance') {
    return s.arkLlmModel || 'seed-2-0-lite-260228';
  }
  return s.llmModel || 'gemini-2.5-flash';
};

export const getApiKey = () => {
  const s = getSettings();
  if (s.provider === 'bytedance') {
    return (s.arkApiKey || '').trim();
  }
  return (s.customApiKey || '').trim();
};

/** Whether to route Veo video generation through Vertex AI (uses GCP $300 credits) */
export const getUseVertexAI = (): boolean => {
  const saved = localStorage.getItem('studioSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      return !!settings.useVertexAI;
    } catch (e) {
      return false;
    }
  }
  return false;
};

/** Supabase Edge Function base URL */
export const getSupabaseEdgeUrl = (): string => {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '';
};

/** Standard headers required for Supabase Edge Function calls */
export const getSupabaseEdgeHeaders = (): Record<string, string> => {
  const env = import.meta.env as Record<string, string | undefined>;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || '';
  return {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
  };
};
