import React, { createContext, useContext, useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';

interface SettingsState {
  projectName: string;
  storagePath: string;
  defaultModel: string;
  llmModel: string;
  defaultAspectRatio: string;
  customApiKey: string;
}

const initialState: SettingsState = {
  projectName: 'My Studio Project',
  storagePath: '/downloads/studio',
  defaultModel: 'veo-2.0-generate-001',
  llmModel: 'gemini-2.5-flash',
  defaultAspectRatio: '16:9',
  customApiKey: '',
};

interface SettingsContextType extends SettingsState {
  directoryHandle: FileSystemDirectoryHandle | null;
  setProjectName: (name: string) => void;
  setStoragePath: (path: string) => void;
  setDefaultModel: (model: string) => void;
  setLlmModel: (model: string) => void;
  setDefaultAspectRatio: (ratio: string) => void;
  setCustomApiKey: (key: string) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('studioSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-migrate deprecated models to latest
      if (parsed.llmModel?.startsWith('gemini-1.5') || parsed.llmModel === 'gemini-2.0-flash') {
        parsed.llmModel = 'gemini-2.5-flash';
      }
      return parsed;
    }
    return initialState;
  });
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Load directory handle from IndexedDB
  useEffect(() => {
    get('studioDirectoryHandle').then((handle) => {
      if (handle) setDirectoryHandle(handle);
    });
  }, []);

  // Save directory handle to IndexedDB
  useEffect(() => {
    if (directoryHandle) {
      set('studioDirectoryHandle', directoryHandle);
    } else {
      // If handle is null, we might want to clear it from IDB too
      // but usually we just leave it or explicitly clear
    }
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
      setProjectName: (projectName) => updateState({ projectName }),
      setStoragePath: (storagePath) => updateState({ storagePath }),
      setDefaultModel: (defaultModel) => updateState({ defaultModel }),
      setLlmModel: (llmModel) => updateState({ llmModel }),
      setDefaultAspectRatio: (defaultAspectRatio) => updateState({ defaultAspectRatio }),
      setCustomApiKey: (customApiKey) => updateState({ customApiKey }),
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
