
export const getLlmModel = () => {
  const saved = localStorage.getItem('studioSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      return settings.llmModel || 'gemini-1.5-flash';
    } catch (e) {
      return 'gemini-1.5-flash';
    }
  }
  return 'gemini-1.5-flash';
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
  
  if (!key) {
    key = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  }

  return key.trim();
};
