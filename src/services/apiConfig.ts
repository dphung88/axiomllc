
export const getLlmModel = () => {
  const saved = localStorage.getItem('studioSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      return settings.llmModel || 'gemini-2.5-flash';
    } catch (e) {
      return 'gemini-2.5-flash';
    }
  }
  return 'gemini-2.5-flash';
};

export const getApiKey = () => {
  const saved = localStorage.getItem('studioSettings');
  let key = '';

  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.customApiKey) {
        key = settings.customApiKey;
      }
    } catch (e) {
      console.error('Error parsing studioSettings', e);
    }
  }

  // No env-var fallback — users must provide their own key via Settings.
  // Falling back to a shared/owner key would charge their billing.

  return key.trim();
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
