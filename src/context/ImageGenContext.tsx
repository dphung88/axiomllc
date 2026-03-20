import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from '../services/geminiService';
import { saveToStudioGallery } from '../services/supabase';
import { useSettings } from './SettingsContext';

interface Log {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface ImageGenState {
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  model: string;
  isGenerating: boolean;
  resultUrl: string | null;
  error: string | null;
  logs: Log[];
}

interface ImageGenContextType extends ImageGenState {
  setPrompt: (prompt: string) => void;
  setAspectRatio: (ratio: string) => void;
  setImageSize: (size: string) => void;
  setModel: (model: string) => void;
  handleGenerate: () => Promise<void>;
  reset: () => void;
  addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const initialState: ImageGenState = {
  prompt: '',
  aspectRatio: '1:1',
  imageSize: '1K',
  model: 'gemini-3-pro-image-preview',
  isGenerating: false,
  resultUrl: null,
  error: null,
  logs: [],
};

const ImageGenContext = createContext<ImageGenContextType | undefined>(undefined);

export const ImageGenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ImageGenState>(initialState);
  const { customApiKey } = useSettings();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('imageGenState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({ ...prev, ...parsed, isGenerating: false }));
      } catch (e) {
        console.error('Failed to parse imageGenState', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    const { isGenerating, ...toSave } = state;
    localStorage.setItem('imageGenState', JSON.stringify(toSave));
  }, [state]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { time: new Date().toLocaleTimeString(), message, type }]
    }));
  }, []);

  const handleGenerate = async () => {
    const { prompt, aspectRatio, imageSize, model } = stateRef.current;
    if (!prompt) return;

    setState(prev => ({ ...prev, isGenerating: true, error: null, resultUrl: null }));
    addLog(`Starting image generation with ${model}...`, 'info');
    addLog(`Prompt: ${prompt}`, 'info');
    addLog(`Settings: ${aspectRatio}, ${imageSize}`, 'info');

    try {
      const url = await generateImage(prompt, aspectRatio, imageSize, model);
      setState(prev => ({ ...prev, resultUrl: url, isGenerating: false }));
      addLog('Image generated successfully!', 'success');
      
      // Auto-save to Supabase
      saveToStudioGallery({
        type: 'image',
        url,
        prompt,
        settings: { aspectRatio, imageSize, model }
      });
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Failed to generate image';
      setState(prev => ({ ...prev, error: msg, isGenerating: false }));
      addLog(`Error: ${msg}`, 'error');
    }
  };

  const reset = () => {
    setState(initialState);
    localStorage.removeItem('imageGenState');
  };

  return (
    <ImageGenContext.Provider value={{
      ...state,
      setPrompt: (prompt) => setState(prev => ({ ...prev, prompt })),
      setAspectRatio: (aspectRatio) => setState(prev => ({ ...prev, aspectRatio })),
      setImageSize: (imageSize) => setState(prev => ({ ...prev, imageSize })),
      setModel: (model) => setState(prev => ({ ...prev, model })),
      handleGenerate,
      reset,
      addLog
    }}>
      {children}
    </ImageGenContext.Provider>
  );
};

export const useImageGen = () => {
  const context = useContext(ImageGenContext);
  if (!context) throw new Error('useImageGen must be used within ImageGenProvider');
  return context;
};
