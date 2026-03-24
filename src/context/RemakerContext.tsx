import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateVideo, pollVideoOperation } from '../services/veoService';
import { concatVideos } from '../services/videoAssemblyService';
import { improveScenePrompt, generateSpeech } from '../services/geminiService';
import { saveToStudioGallery, supabase } from '../services/supabase';
import { storeVideoBlob, getVideoBlob, clearAllVideoBlobs } from '../services/videoStorage';
import { useSettings } from './SettingsContext';

import { AspectRatio } from '../types';

export interface RemadeScene {
  url: string;
  loading: boolean;
  error?: string;
  startTime?: number;
  status?: 'queued' | 'processing' | 'done' | 'error';
  audioUrl?: string;      // TTS narration URL
  narration?: string;     // narration text for this scene
  customPrompt?: string;  // user-overridden prompt for this scene
  savedUrl?: string;      // persisted Supabase URL
}

export interface SystemLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface RemakerState {
  step: number;
  originalVideoUrl: string | null;
  videoDuration: number;
  targetSceneCount: number;
  scenes: any[];
  selectedStyle: string;
  customStyle: string;
  characterStyle: string;  // character consistency description
  aspectRatio: AspectRatio;
  veoModel: string;
  isGenerating: boolean;
  remadeScenes: RemadeScene[];
  finalVideo: string | null;
  isAssembling: boolean;
  assemblyProgress: number;
  assemblyError: string | null;
  hasApiKey: boolean;
  logs: SystemLog[];
}

const initialState: RemakerState = {
  step: 1,
  originalVideoUrl: null,
  videoDuration: 0,
  targetSceneCount: 5,
  scenes: [],
  selectedStyle: 'Anime',
  customStyle: '',
  characterStyle: '',
  aspectRatio: '16:9',
  veoModel: 'veo-3.1-fast-generate-preview',
  isGenerating: false,
  remadeScenes: [],
  finalVideo: null,
  isAssembling: false,
  assemblyProgress: 0,
  assemblyError: null,
  hasApiKey: false,
  logs: [],
};

// Background tasks map to survive unmounts
const activeTasks = new Map<string, boolean>();
let isSequentialLoopRunning = false;
let currentGenerationId = 0;

interface RemakerContextType extends RemakerState {
  setStep: (step: number) => void;
  setOriginalVideoUrl: (url: string | null) => void;
  setVideoDuration: (duration: number) => void;
  setTargetSceneCount: (count: number) => void;
  setScenes: (scenes: any[]) => void;
  setSelectedStyle: (style: string) => void;
  setCustomStyle: (style: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setVeoModel: (model: string) => void;
  setCharacterStyle: (style: string) => void;
  startGeneration: () => void;
  reGenerateAll: () => void;
  retryVariant: (sceneIndex: number) => void;
  assembleFinalVideo: () => void;
  resumeGeneration: () => void;
  repromptScene: (index: number) => Promise<void>;
  repromptSceneWithPrompt: (index: number, newPrompt: string) => void;
  reset: () => void;
  openKeySelection: () => Promise<void>;
  checkApiKey: () => Promise<boolean>;
  addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const RemakerContext = createContext<RemakerContextType | undefined>(undefined);

export const RemakerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<RemakerState>(initialState);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { customApiKey } = useSettings();
  
  // Use a ref to access the latest state in async functions without adding them to dependencies
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('remakerState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // One-time migration: delete stale characterStyle from old localStorage entries
        if (parsed.characterStyle !== undefined) {
          delete parsed.characterStyle;
          localStorage.setItem('remakerState', JSON.stringify(parsed));
        }

        let hasPendingVideos = false;
        if (parsed.remadeScenes && parsed.remadeScenes.length > 0) {
          hasPendingVideos = parsed.remadeScenes.some((s: any) =>
            s.loading || s.status === 'processing' || s.status === 'queued'
          );
        }

        // Restore fresh blob URLs from IndexedDB for completed scenes
        if (parsed.remadeScenes && parsed.remadeScenes.length > 0) {
          const restoreUrls = async () => {
            const restoredScenes = await Promise.all(
              parsed.remadeScenes.map(async (s: any, i: number) => {
                if (s.status === 'done') {
                  const freshUrl = await getVideoBlob(`scene-${i}`);
                  if (freshUrl) return { ...s, url: freshUrl };
                  // Blob gone — mark for retry
                  return { ...s, url: '', status: 'error', error: 'Session expired. Please retry.' };
                }
                return s;
              })
            );
            parsed.remadeScenes = restoredScenes;

            setState(prev => {
              const { hasApiKey: _ignored, characterStyle: _noChar, ...parsedWithoutApiKey } = parsed;
              const newState = {
                ...prev,
                ...parsedWithoutApiKey,
                characterStyle: '',  // Never restored — must be entered fresh each session
                isGenerating: hasPendingVideos,
                isAssembling: false
              };
              stateRef.current = newState;
              return newState;
            });

            if (hasPendingVideos) {
              setTimeout(() => {
                if (stateRef.current.isGenerating) processQueue();
              }, 1000);
            }
          };
          restoreUrls();
        } else {
          setState(prev => {
            const { hasApiKey: _ignored, characterStyle: _noChar, ...parsedWithoutApiKey } = parsed;
            const newState = {
              ...prev,
              ...parsedWithoutApiKey,
              characterStyle: '',  // Never restored — must be entered fresh each session
              isGenerating: hasPendingVideos,
              isAssembling: false
            };
            stateRef.current = newState;
            return newState;
          });

          if (hasPendingVideos) {
            setTimeout(() => {
              if (stateRef.current.isGenerating) processQueue();
            }, 1000);
          }
        }
      } catch (e) {
        console.error('Failed to parse remaker state', e);
      }
    }
    setIsLoaded(true);

    // Check API key AFTER restoring state so it doesn't get overwritten
    const checkKey = async () => {
      if (customApiKey) {
        updateState({ hasApiKey: true });
        return;
      }
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        updateState({ hasApiKey: hasKey });
      } else {
        updateState({ hasApiKey: false });
      }
    };
    checkKey();
  }, [customApiKey]);

  // Save to localStorage on change (exclude characterStyle — must be entered fresh each session)
  useEffect(() => {
    if (isLoaded) {
      const { characterStyle: _excluded, ...stateToSave } = state;
      localStorage.setItem('remakerState', JSON.stringify(stateToSave));
    }
  }, [state, isLoaded]);

  const updateState = (updates: Partial<RemakerState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      stateRef.current = newState;
      return newState;
    });
  };

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setState(prev => {
      const newLog: SystemLog = {
        time: new Date().toLocaleTimeString(),
        message,
        type
      };
      const newState = { ...prev, logs: [...prev.logs, newLog].slice(-100) }; // Keep last 100 logs
      stateRef.current = newState;
      return newState;
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const clearToast = useCallback(() => setToastMessage(null), []);

  const generateSceneWithRetry = async (index: number, prompt: string, aspectRatio: AspectRatio, model: string, maxRetries = 5) => {
    let attempt = 0;
    // Aggressive backoff for Quota issues: 20s, 40s, 60s, 120s, 180s
    const backoffDelays = [20000, 40000, 60000, 120000, 180000];

    while (attempt <= maxRetries) {
      try {
        const operation = await generateVideo(prompt, undefined, undefined, aspectRatio, '720p', model);
        const url = await pollVideoOperation(operation);
        return url;
      } catch (error: any) {
        console.error(`Scene ${index + 1} generation failed (Attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        
        const errorMsg = error?.message?.toLowerCase() || (typeof error === 'string' ? error.toLowerCase() : '');
        const isQuotaError = errorMsg.includes('quota') || errorMsg.includes('429') || error?.status === 429 || error?.code === 429 || errorMsg.includes('too many requests');

        if (attempt === maxRetries) {
          if (isQuotaError) {
            throw new Error('API Quota strictly exceeded after multiple retries. Please wait 5-10 minutes or check your billing.');
          }
          throw error;
        }

        const delay = isQuotaError ? backoffDelays[attempt] : 5000;
        if (isQuotaError) {
          addLog(`API Quota hit. Attempt ${attempt + 1}. Waiting ${delay/1000}s before retry...`, 'error');
          showToast(`Quota hit. Waiting ${delay/1000}s before auto-retry...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    throw new Error('Max retries exceeded');
  };

  const processQueue = async () => {
    if (isSequentialLoopRunning) return;
    isSequentialLoopRunning = true;
    const myGenerationId = currentGenerationId;

    try {
      while (true) {
        if (myGenerationId !== currentGenerationId) break;
        const currentState = stateRef.current;
        if (!currentState.isGenerating) break;

        // Find the first scene that needs to be generated
        let sceneIndexToProcess = -1;
        
        for (let i = 0; i < currentState.remadeScenes.length; i++) {
          const scene = currentState.remadeScenes[i];
          // Tricky point: Look for truly 'queued' OR stuck 'processing'
          if (scene.status === 'queued' || (scene.loading && !scene.url && !scene.error && scene.status === 'processing')) {
            sceneIndexToProcess = i;
            break;
          }
        }
        
        if (sceneIndexToProcess === -1) {
          // No more scenes to process
          const allDone = currentState.remadeScenes.every(s => s.status === 'done' || s.status === 'error');
          if (allDone) {
            setState(prev => {
              const newState = { ...prev, isGenerating: false };
              stateRef.current = newState;
              return newState;
            });
          }
          break;
        }

        const taskKey = `${sceneIndexToProcess}`;
        activeTasks.set(taskKey, true);

        const { scenes, selectedStyle, customStyle, characterStyle, videoDuration, targetSceneCount, aspectRatio, veoModel, remadeScenes } = currentState;
        const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;
        const scene = scenes[sceneIndexToProcess];
        const duration = Math.min(8, Math.ceil(videoDuration / targetSceneCount));

        // Character consistency prefix
        const charPrefix = characterStyle ? `Character style: ${characterStyle}. Maintain consistent character appearance. ` : '';

        // Use custom prompt if set by user (re-prompt feature), otherwise build from scene data
        const customPrompt = remadeScenes[sceneIndexToProcess]?.customPrompt;
        let prompt = customPrompt
          ? `${charPrefix}${customPrompt}`
          : `${charPrefix}A cinematic video in ${styleToUse} style. Action: ${scene.action}. ${scene.characters ? `Characters: ${scene.characters}.` : ''} ${scene.setting ? `Setting: ${scene.setting}.` : ''} Atmosphere: ${scene.mood}. Duration: ${duration} seconds. High quality, detailed textures, consistent lighting.`;

        addLog(`Processing Scene ${sceneIndexToProcess + 1}/${currentState.remadeScenes.length}: "${prompt.substring(0, 80)}..."`, 'info');

        setState(prev => {
          const newScenes = [...prev.remadeScenes];
          newScenes[sceneIndexToProcess] = { 
            ...newScenes[sceneIndexToProcess], 
            loading: true, 
            status: 'processing',
            error: undefined, 
            startTime: Date.now() 
          };
          const newState = { ...prev, remadeScenes: newScenes };
          stateRef.current = newState;
          return newState;
        });

        try {
          const url = await generateSceneWithRetry(sceneIndexToProcess, prompt, aspectRatio, veoModel);
          if (myGenerationId !== currentGenerationId || !activeTasks.has(taskKey)) return; 

          addLog(`Scene ${sceneIndexToProcess + 1} generated successfully.`, 'success');

          // Persist blob to IndexedDB so it survives page refreshes
          try {
            const blobRes = await fetch(url);
            const blob = await blobRes.blob();
            await storeVideoBlob(`scene-${sceneIndexToProcess}`, blob);
            addLog(`Scene ${sceneIndexToProcess + 1} saved to local storage.`, 'info');
          } catch (storageErr) {
            console.warn('[RemakerContext] IndexedDB store failed:', storageErr);
          }

          // Auto-save each scene video to Supabase
          let savedUrl: string | undefined;
          try {
            const { data: saved } = await saveToStudioGallery({
              type: 'video',
              url,
              prompt,
              settings: { source: 'remaker-scene', index: sceneIndexToProcess, model: veoModel }
            }) as any;
            savedUrl = saved?.publicUrl || undefined;
          } catch (_) {}

          // Generate TTS narration and upload to Supabase (blob URLs don't survive state save/restore)
          // Prefer 'narration' field (voiceover text) over 'action' (brief description)
          const scene = scenes[sceneIndexToProcess];
          const narrationText = scene?.narration || scene?.action || '';
          let audioUrl: string | undefined;
          if (narrationText) {
            const parseRetryDelay = (msg: string) => {
              const m = msg.match(/retry in ([\d.]+)s/i);
              return m ? Math.ceil(parseFloat(m[1])) * 1000 + 3000 : 65000;
            };
            for (let ttsAttempt = 0; ttsAttempt < 4; ttsAttempt++) {
              try {
                const blobUrl = await generateSpeech(narrationText, 'en');
                const audioRes = await fetch(blobUrl);
                const audioBlob = await audioRes.blob();
                const audioFilename = `audio/remaker-scene-${sceneIndexToProcess}-${Date.now()}.wav`;
                const { error: audioUploadErr } = await supabase.storage
                  .from('studio-media')
                  .upload(audioFilename, audioBlob, { contentType: 'audio/wav', upsert: true });
                if (!audioUploadErr) {
                  const { data: { publicUrl: audioPublicUrl } } = supabase.storage
                    .from('studio-media')
                    .getPublicUrl(audioFilename);
                  audioUrl = audioPublicUrl;
                  addLog(`Scene ${sceneIndexToProcess + 1} narration ready.`, 'info');
                } else {
                  addLog(`Scene ${sceneIndexToProcess + 1} audio upload failed — no voice in assembly.`, 'error');
                }
                break; // success
              } catch (ttsErr: any) {
                const msg = ttsErr.message || '';
                const isQuota = msg.toLowerCase().includes('quota') || msg.includes('429');
                if (isQuota && ttsAttempt < 3) {
                  const waitMs = parseRetryDelay(msg);
                  addLog(`Scene ${sceneIndexToProcess + 1} TTS quota hit, retrying in ${Math.round(waitMs / 1000)}s...`, 'info');
                  await new Promise(r => setTimeout(r, waitMs));
                } else {
                  addLog(`Scene ${sceneIndexToProcess + 1} TTS failed: ${msg}`, 'error');
                  break;
                }
              }
            }
          }

          let isAllDone = false;
          setState(prev => {
            const newScenes = [...prev.remadeScenes];
            newScenes[sceneIndexToProcess] = {
              ...newScenes[sceneIndexToProcess],
              loading: false,
              url,
              savedUrl,
              audioUrl,
              narration: narrationText,  // store the text used for TTS
              status: 'done',
              startTime: undefined
            };
            
            // Check if this was the last scene
            const remaining = newScenes.some(s => s.status === 'queued' || s.status === 'processing');
            if (!remaining) isAllDone = true;

            const newState = { ...prev, remadeScenes: newScenes };
            stateRef.current = newState;
            return newState;
          });

          // AUTO-ASSEMBLE if all done successfully
          if (isAllDone) {
            const allSuccessful = stateRef.current.remadeScenes.every(s => s.url && s.status === 'done');
            if (allSuccessful) {
              addLog('All scenes generated successfully. Auto-starting master assembly...', 'success');
              showToast('All scenes done! Assembling master...');
              setTimeout(() => assembleFinalVideo(), 2000);
            } else {
              addLog('Generation cycle complete with some errors. Manual retry required.', 'error');
              showToast('Some scenes failed. Please retry them manually.');
            }
          }

        } catch (error: any) {
          if (myGenerationId !== currentGenerationId || !activeTasks.has(taskKey)) return; 
          const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          addLog(`Error in Scene ${sceneIndexToProcess + 1}: ${errorMessage}`, 'error');
          setState(prev => {
            const newScenes = [...prev.remadeScenes];
            newScenes[sceneIndexToProcess] = { 
              ...newScenes[sceneIndexToProcess], 
              loading: false, 
              error: errorMessage, 
              status: 'error',
              startTime: undefined 
            };
            const newState = { ...prev, remadeScenes: newScenes };
            stateRef.current = newState;
            return newState;
          });
          
          if (error?.message?.includes('Quota Exceeded')) {
            updateState({ isGenerating: false });
            break;
          }
        } finally {
          activeTasks.delete(taskKey);
        }
        
        if (myGenerationId !== currentGenerationId) break;
        // Short cooldown between scenes to avoid immediate quota hit
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } finally {
      if (myGenerationId === currentGenerationId) {
        isSequentialLoopRunning = false;
      }
    }
  };

  const startGeneration = () => {
    const currentState = stateRef.current;
    // Re-check customApiKey directly in case hasApiKey state is stale
    const hasKey = currentState.hasApiKey || !!customApiKey;
    if (!hasKey) {
      openKeySelection();
      return;
    }

    if (!currentState.scenes || currentState.scenes.length === 0) {
      showToast('Please analyze a video first.');
      return;
    }

    currentGenerationId++;
    isSequentialLoopRunning = false;
    
    // SIMPLE 1 video per scene mode
    const initialRemadeScenes = currentState.scenes.map(() => ({ 
      url: '', loading: false, status: 'queued' as const
    }));

    addLog(`Starting generation for ${initialRemadeScenes.length} scenes using ${currentState.veoModel}...`, 'info');

    const newState = {
      ...currentState,
      step: 4,
      isGenerating: true,
      remadeScenes: initialRemadeScenes,
      finalVideo: null,
      isAssembling: false,
      logs: [...currentState.logs, { time: new Date().toLocaleTimeString(), message: 'Initiating generation cycle...', type: 'info' as const }]
    };

    setState(newState);
    stateRef.current = newState;

    // Start processing queue
    setTimeout(() => processQueue(), 500);
  };

  const reGenerateAll = () => {
    if (!stateRef.current.hasApiKey) {
      openKeySelection();
      return;
    }
    
    currentGenerationId++;
    
    const currentState = stateRef.current;
    const initialRemadeScenes = currentState.scenes.map(() => ({ 
      url: '', loading: false, status: 'queued' as const
    }));

    const newState = { 
      ...currentState, 
      isGenerating: true, 
      remadeScenes: initialRemadeScenes, 
      finalVideo: null,
      assemblyError: null
    };

    setState(newState);
    stateRef.current = newState;

    setTimeout(() => {
      isSequentialLoopRunning = false;
      processQueue();
    }, 100);
  };

  const resumeGeneration = () => {
    if (!stateRef.current.hasApiKey) {
      openKeySelection();
      return;
    }
    
    // Just ensure the queue is running for pending tasks
    const newState = { ...stateRef.current, isGenerating: true };
    setState(newState);
    stateRef.current = newState;

    setTimeout(() => {
      isSequentialLoopRunning = false;
      processQueue();
    }, 100);
  };

  const retryVariant = (sceneIndex: number) => {
    if (!stateRef.current.hasApiKey) {
      openKeySelection();
      return;
    }
    
    // Increment generation ID to cancel any pending error states but keep loop going
    currentGenerationId++;
    
    const currentState = stateRef.current;
    const newScenes = [...currentState.remadeScenes];
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading: false, status: 'queued' as const, error: undefined, url: '' };
    
    const newState = { ...currentState, remadeScenes: newScenes, isGenerating: true };
    setState(newState);
    stateRef.current = newState;

    // Always attempt to restart queue
    setTimeout(() => {
      isSequentialLoopRunning = false;
      processQueue();
    }, 100);
  };

  const assembleFinalVideo = async () => {
    const { remadeScenes } = stateRef.current;

    // Refresh blob URLs from IndexedDB — blob: URLs expire on page reload
    addLog('Refreshing scene URLs from local storage...', 'info');
    const freshScenes = await Promise.all(
      remadeScenes.map(async (s, i) => {
        if (!s.url && s.status !== 'done') return s;
        const freshUrl = await getVideoBlob(`scene-${i}`);
        if (freshUrl) return { ...s, url: freshUrl };
        return s; // fall back to existing URL (same session)
      })
    );

    const scenesToMerge = freshScenes
      .filter(s => s.url)
      .map(s => ({ videoUrl: s.savedUrl || s.url, audioUrl: s.audioUrl }));

    if (scenesToMerge.length === 0) {
      addLog('Assembly failed: No successful scenes found to merge.', 'error');
      return;
    }

    addLog(`Assembling final master from ${scenesToMerge.length} scenes...`, 'info');
    updateState({ isAssembling: true, assemblyProgress: 0, assemblyError: null });
    try {
      const finalUrl = await concatVideos(scenesToMerge, (progress) => {
        const percent = Math.round(progress * 100);
        if (percent % 25 === 0 && percent > 0) {
          addLog(`Assembly progress: ${percent}%`, 'info');
        }
        updateState({ assemblyProgress: percent });
      });
      addLog('Master assembly complete!', 'success');
      updateState({ finalVideo: finalUrl, isAssembling: false, assemblyProgress: 100 });

      // Auto-save final assembled master video
      const currentStateSnap = stateRef.current;
      saveToStudioGallery({
        type: 'video',
        url: finalUrl,
        prompt: `Remake master for style ${currentStateSnap.selectedStyle}`,
        settings: { source: 'remaker-master', style: currentStateSnap.selectedStyle, sceneCount: currentStateSnap.scenes.length }
      });
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error during assembly';
      console.error('Concat failed', error);
      addLog(`Master assembly failed: ${errorMsg}`, 'error');
      updateState({ isAssembling: false, assemblyError: errorMsg });
      showToast('Failed to assemble video');
    }
  };

  const reset = () => {
    currentGenerationId++;
    setState(initialState);
    stateRef.current = initialState;
    localStorage.removeItem('remakerState');
    isSequentialLoopRunning = false;
    activeTasks.clear();
    clearAllVideoBlobs(); // clear persisted video blobs
  };

  const openKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      const hasKey = await window.aistudio.hasSelectedApiKey();
      updateState({ hasApiKey: hasKey });
    }
  };

  // User types their own new prompt for a scene → queue it for regeneration
  const repromptSceneWithPrompt = (index: number, newPrompt: string) => {
    currentGenerationId++;
    isSequentialLoopRunning = false;
    setState(prev => {
      const newScenes = [...prev.remadeScenes];
      newScenes[index] = {
        ...newScenes[index],
        customPrompt: newPrompt,
        status: 'queued',
        loading: false,
        url: '',
        error: undefined,
      };
      const newState = { ...prev, remadeScenes: newScenes, isGenerating: true };
      stateRef.current = newState;
      return newState;
    });
    setTimeout(processQueue, 100);
  };

  const repromptScene = async (index: number) => {
    const { scenes, selectedStyle, customStyle } = stateRef.current;
    const scene = scenes[index];
    const styleToUse = selectedStyle === 'Custom' ? customStyle : selectedStyle;

    showToast(`Improving Scene ${index + 1}...`);
    try {
      const result = await improveScenePrompt(scene.action, scene.mood, styleToUse);
      if (result.action && result.mood) {
        setState(prev => {
          const newScenes = [...prev.scenes];
          newScenes[index] = { 
            ...newScenes[index], 
            action: result.action, 
            mood: result.mood 
          };
          return { ...prev, scenes: newScenes };
        });
        showToast(`Scene ${index + 1} updated!`);
      }
    } catch (error) {
      showToast('Failed to improve prompt');
    }
  };

  const checkApiKey = async () => {
    if (customApiKey) {
      updateState({ hasApiKey: true });
      return true;
    }
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      updateState({ hasApiKey: hasKey });
      return hasKey;
    }
    return false;
  };

  return (
    <RemakerContext.Provider value={{
      ...state,
      setStep: (step) => updateState({ step }),
      setCharacterStyle: (characterStyle) => updateState({ characterStyle }),
      setOriginalVideoUrl: (url) => updateState({ originalVideoUrl: url }),
      setVideoDuration: (duration) => updateState({ videoDuration: duration }),
      setTargetSceneCount: (count) => updateState({ targetSceneCount: count }),
      setScenes: (scenes) => updateState({ scenes }),
      setSelectedStyle: (selectedStyle) => updateState({ selectedStyle }),
      setCustomStyle: (customStyle) => updateState({ customStyle }),
      setAspectRatio: (aspectRatio) => updateState({ aspectRatio }),
      setVeoModel: (veoModel) => updateState({ veoModel }),
      startGeneration,
      reGenerateAll,
      retryVariant,
      assembleFinalVideo,
      resumeGeneration,
      repromptScene,
      repromptSceneWithPrompt,
      reset,
      openKeySelection,
      checkApiKey,
      addLog,
      toastMessage,
      showToast,
      clearToast
    }}>
      {children}
    </RemakerContext.Provider>
  );
};

export const useRemaker = () => {
  const context = useContext(RemakerContext);
  if (!context) throw new Error('useRemaker must be used within RemakerProvider');
  return context;
};
