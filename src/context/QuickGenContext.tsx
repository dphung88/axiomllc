import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { generateVideo, pollVideoOperation } from '../services/videoService';
import { saveToStudioGallery } from '../services/supabase';
import { AspectRatio } from '../types';

interface QuickGenLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface QuickGenState {
  isGenerating: boolean;
  resultUrl: string | null;
  error: string | null;
  logs: QuickGenLog[];
  prompt: string;
  activeTab: 'text' | 'image' | 'video' | 'logs';
  aspectRatio: AspectRatio;
  veoModel: string;
  image: { data: string; mimeType: string; url: string } | null;
  lastFrame: { data: string; mimeType: string; url: string } | null;
}

interface QuickGenContextType extends QuickGenState {
  setPrompt: (prompt: string) => void;
  setActiveTab: (tab: QuickGenState['activeTab']) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setVeoModel: (model: string) => void;
  setImage: (image: QuickGenState['image']) => void;
  setLastFrame: (frame: QuickGenState['lastFrame']) => void;
  setResultUrl: (url: string | null) => void;
  setError: (error: string | null) => void;
  setLogs: (logs: QuickGenLog[]) => void;
  handleGenerate: () => Promise<void>;
  resetGeneration: () => void;
}

const QuickGenContext = createContext<QuickGenContextType | undefined>(undefined);

export function QuickGenProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuickGenState>({
    isGenerating: false,
    resultUrl: null,
    error: null,
    logs: [],
    prompt: '',
    activeTab: 'text',
    aspectRatio: '16:9',
    veoModel: 'veo-3.1-fast-generate-preview',
    image: null,
    lastFrame: null,
  });

  const addLog = (message: string, type: QuickGenLog['type'] = 'info') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { time: new Date().toLocaleTimeString(), message, type }]
    }));
  };

  const handleGenerate = async () => {
    if (!state.prompt) return;
    
    setState(prev => ({
      ...prev,
      isGenerating: true,
      resultUrl: null,
      error: null,
      logs: []
    }));
    
    addLog(`Starting video generation (${state.activeTab} to video)...`, 'info');

    try {
      addLog('Sending request to Veo 3.1...', 'info');
      const operation = await generateVideo(
        state.prompt,
        state.activeTab === 'image' || state.activeTab === 'video' ? state.image || undefined : undefined,
        state.activeTab === 'video' ? state.lastFrame || undefined : undefined,
        state.aspectRatio,
        '720p',
        state.veoModel
      );
      addLog('Operation created. Polling for completion...', 'info');
      const url = await pollVideoOperation(operation);
      addLog('Video generated successfully.', 'success');
      setState(prev => ({ ...prev, resultUrl: url, isGenerating: false }));
      
      // Auto-save to Supabase
      saveToStudioGallery({
        type: 'video',
        url,
        prompt: state.prompt,
        settings: { 
          source: 'quick-gen',
          tab: state.activeTab,
          aspectRatio: state.aspectRatio, 
          model: state.veoModel 
        }
      });
    } catch (err: any) {
      let errorMsg = err?.message || (typeof err === 'string' ? err : 'Unknown error');
      if (errorMsg.includes('quota') || errorMsg.includes('429') || err?.status === 429 || err?.code === 429) {
        errorMsg = 'API Quota Exceeded. Please check your Gemini API plan and billing details.';
      }
      addLog(`Error: ${errorMsg}`, 'error');
      setState(prev => ({ ...prev, error: errorMsg, isGenerating: false }));
    }
  };

  const resetGeneration = () => {
    setState(prev => ({
      ...prev,
      prompt: '',
      image: null,
      lastFrame: null,
      resultUrl: null,
      error: null,
      logs: []
    }));
  };

  const value = {
    ...state,
    setPrompt: (prompt: string) => setState(prev => ({ ...prev, prompt })),
    setActiveTab: (activeTab: QuickGenState['activeTab']) => setState(prev => ({ ...prev, activeTab })),
    setAspectRatio: (aspectRatio: AspectRatio) => setState(prev => ({ ...prev, aspectRatio })),
    setVeoModel: (veoModel: string) => setState(prev => ({ ...prev, veoModel })),
    setImage: (image: QuickGenState['image']) => setState(prev => ({ ...prev, image })),
    setLastFrame: (lastFrame: QuickGenState['lastFrame']) => setState(prev => ({ ...prev, lastFrame })),
    setResultUrl: (resultUrl: string | null) => setState(prev => ({ ...prev, resultUrl })),
    setError: (error: string | null) => setState(prev => ({ ...prev, error })),
    setLogs: (logs: QuickGenLog[]) => setState(prev => ({ ...prev, logs })),
    handleGenerate,
    resetGeneration,
  };

  return <QuickGenContext.Provider value={value}>{children}</QuickGenContext.Provider>;
}

export function useQuickGen() {
  const context = useContext(QuickGenContext);
  if (context === undefined) {
    throw new Error('useQuickGen must be used within a QuickGenProvider');
  }
  return context;
}
