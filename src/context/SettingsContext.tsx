import React, { createContext, useContext, useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';

export type AIProvider = 'google' | 'bytedance';

interface SettingsState {
  provider: AIProvider;
  projectName: string;
  storagePath: string;
  defaultModel: string;
  llmModel: string;
  defaultAspectRatio: string;
  // Google
  customApiKey: string;
  useVertexAI: boolean;
  googleEnabled: boolean;
  // ByteDance
  arkApiKey: string;
  arkDefaultModel: string;
  arkLlmModel: string;
  arkVideoEndpoint: string;   // Custom inference endpoint ID from BytePlus Console (ep-xxxx)
  bytedanceEnabled: boolean;
}

const initialState: SettingsState = {
  provider: 'google',
  projectName: 'My Studio Project',
  storagePath: '/downloads/studio',
  defaultModel: 'veo-2.0-generate-001',
  llmModel: 'gemini-2.5-flash',
  defaultAspectRatio: '16:9',
  customApiKey: '',
  useVertexAI: false,
  googleEnabled: true,
  arkApiKey: '',
  arkDefaultModel: 'seedance-1-5-pro',
  arkLlmModel: 'seed-2-0-lite-260228',
  arkVideoEndpoint: '',
  bytedanceEnabled: true,
};

interface SettingsContextType extends SettingsState {
  directoryHandle: FileSystemDirectoryHandle | null;
  setProvider: (provider: AIProvider) => void;
  setProjectName: (name: string) => void;
  setStoragePath: (path: string) => void;
  setDefaultModel: (model: string) => void;
  setLlmModel: (model: string) => void;
  setDefaultAspectRatio: (ratio: string) => void;
  setCustomApiKey: (key: string) => void;
  setUseVertexAI: (val: boolean) => void;
  setGoogleEnabled: (val: boolean) => void;
  setArkApiKey: (key: string) => void;
  setArkDefaultModel: (model: string) => void;
  setArkLlmModel: (model: string) => void;
  setArkVideoEndpoint: (endpoint: string) => void;
  setBytedanceEnabled: (val: boolean) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('studioSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-migrate deprecated models
      if (parsed.llmModel?.startsWith('gemini-1.5') || parsed.llmModel === 'gemini-2.0-flash') {
        parsed.llmModel = 'gemini-2.5-flash';
      }
      // Ensure new fields have defaults
      return { ...initialState, ...parsed };
    }
    return initialState;
  });
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    get('studioDirectoryHandle').then((handle) => {
      if (handle) setDirectoryHandle(handle);
    });
  }, []);

  useEffect(() => {
    if (directoryHandle) set('studioDirectoryHandle', directoryHandle);
  }, [directoryHandle]);

  useEffect(() => {
    localStorage.setItem('studioSettings', JSON.stringify(state));
  }, [state]);

  const updateState = (updates: Partial<SettingsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{
      ...state,
      directoryHandle,
      setProvider: (provider) => updateState({ provider }),
      setProjectName: (projectName) => updateState({ projectName }),
      setStoragePath: (storagePath) => updateState({ storagePath }),
      setDefaultModel: (defaultModel) => updateState({ defaultModel }),
      setLlmModel: (llmModel) => updateState({ llmModel }),
      setDefaultAspectRatio: (defaultAspectRatio) => updateState({ defaultAspectRatio }),
      setCustomApiKey: (customApiKey) => updateState({ customApiKey }),
      setUseVertexAI: (useVertexAI) => updateState({ useVertexAI }),
      setGoogleEnabled: (googleEnabled) => updateState({ googleEnabled }),
      setArkApiKey: (arkApiKey) => updateState({ arkApiKey }),
      setArkDefaultModel: (arkDefaultModel) => updateState({ arkDefaultModel }),
      setArkLlmModel: (arkLlmModel) => updateState({ arkLlmModel }),
      setArkVideoEndpoint: (arkVideoEndpoint) => updateState({ arkVideoEndpoint }),
      setBytedanceEnabled: (bytedanceEnabled) => updateState({ bytedanceEnabled }),
      setDirectoryHandle: (handle) => setDirectoryHandle(handle),
      resetSettings: () => {
        setState(initialState);
        setDirectoryHandle(null);
      },
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
