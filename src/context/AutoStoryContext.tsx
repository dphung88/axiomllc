import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { generateAutoScript, generateScriptFromVideo, extractFrames, generateSpeech } from '../services/geminiService';
import { generateVideo, pollVideoOperation } from '../services/veoService';
import { concatVideos } from '../services/videoAssemblyService';
import { saveToStudioGallery, supabase } from '../services/supabase';
import { AspectRatio } from '../types';
import { useSettings } from './SettingsContext';

export interface ScriptData {
  characters: { name: string; description: string }[];
  settings: { name: string; description: string }[];
  scenes: { sceneNumber: number; action: string; prompt: string; narration?: string }[];
}

export interface SceneState {
  url?: string;
  savedUrl?: string;         // permanent Supabase URL (use this for assembly)
  loading: boolean;
  error?: string;
  isUpscaling?: boolean;
  resolution?: '720p' | '1080p';
  status?: 'queued' | 'processing' | 'done' | 'error';
  audioUrl?: string;
  audioLoading?: boolean;
  audioError?: string;
  customPrompt?: string;     // user's custom reprompt override
  url2?: string;             // alternative variant URL
  savedUrl2?: string;        // permanent Supabase URL for variant 2
  loading2?: boolean;        // loading state for alt variant
  error2?: string;           // error for alt variant
  activeVariant?: 1 | 2;    // which variant is currently selected (default 1)
}

export interface AutoStoryState {
  inputType: 'text' | 'video';
  idea: string;
  style: string;
  sceneCount: number;
  language: 'en' | 'vi' | 'none';
  aspectRatio: AspectRatio;
  veoModel: string;
  activeTab: 'script' | 'prompts' | 'videos';
  isGeneratingScript: boolean;
  scriptData: ScriptData | null;
  scenesState: SceneState[];
  isGeneratingVideos: boolean;
  generationProgress: { current: number; total: number };
  finalVideo: string | null;
  isAssembling: boolean;
  assemblyProgress: number;
  assemblyError: string | null;
  workflowError: string | null;
  hasApiKey: boolean;
  showSubtitles: boolean;
  characterStyle: string;
}

const initialState: AutoStoryState = {
  inputType: 'text',
  idea: '',
  style: '3D Pixar',
  sceneCount: 6,
  language: 'en',
  aspectRatio: '16:9',
  veoModel: 'veo-3.1-fast-generate-preview',
  activeTab: 'script',
  isGeneratingScript: false,
  scriptData: null,
  scenesState: [],
  isGeneratingVideos: false,
  generationProgress: { current: 0, total: 0 },
  finalVideo: null,
  isAssembling: false,
  assemblyProgress: 0,
  assemblyError: null,
  workflowError: null,
  hasApiKey: false,
  showSubtitles: true,
  characterStyle: ''
};

let isSequentialLoopRunning = false;
let currentGenerationId = 0;

interface AutoStoryContextType extends AutoStoryState {
  setInputType: (type: 'text' | 'video') => void;
  setIdea: (idea: string) => void;
  setStyle: (style: string) => void;
  setSceneCount: (count: number) => void;
  setLanguage: (lang: 'en' | 'vi' | 'none') => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setVeoModel: (model: string) => void;
  setActiveTab: (tab: 'script' | 'prompts' | 'videos') => void;
  generateWorkflow: (videoFile?: File) => Promise<void>;
  retryVariant: (sceneIndex: number) => void;
  upscaleVariant: (sceneIndex: number) => Promise<void>;
  assembleVideo: () => Promise<void>;
  reset: () => void;
  setShowSubtitles: (show: boolean) => void;
  openKeySelection: () => Promise<void>;
  checkApiKey: () => Promise<boolean>;
  openDirectoryPicker: () => Promise<void>;
  setCharacterStyle: (style: string) => void;
  repromptScene: (index: number, customPrompt: string) => void;
  generateAltVariant: (index: number) => Promise<void>;
  switchVariant: (index: number, variant: 1 | 2) => void;
}

const AutoStoryContext = createContext<AutoStoryContextType | undefined>(undefined);

export const AutoStoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AutoStoryState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const stateRef = useRef(state);
  const { customApiKey } = useSettings();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load from localStorage on mount
  useEffect(() => {
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

    const saved = localStorage.getItem('autoStoryState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Check if there are pending video generations
        let hasPendingVideos = false;
        if (parsed.scenesState) {
          hasPendingVideos = parsed.scenesState.some((s: SceneState) => 
            s.loading && !s.url && !s.error
          );
        }

        setState(prev => {
          const newState = { 
            ...prev, 
            ...parsed, 
            isGeneratingScript: false,
            isGeneratingVideos: hasPendingVideos, 
            isAssembling: false 
          };
          stateRef.current = newState;
          return newState;
        });

        if (hasPendingVideos) {
          setTimeout(processQueue, 1000);
        }
      } catch (e) {
        console.error('Failed to parse autoStory state', e);
      }
    }
    setIsLoaded(true);
  }, [customApiKey]);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        // Deep clone and strip non-serializable properties to prevent circular structure errors
        const cleanState = JSON.parse(JSON.stringify(state, (key, value) => {
          if (value instanceof HTMLElement || (value && value.constructor && value.constructor.name === 'FiberNode')) {
            return undefined;
          }
          return value;
        }));
        localStorage.setItem('autoStoryState', JSON.stringify(cleanState));
      } catch (e) {
        console.warn('Failed to save state to localStorage safely:', e);
        // Fallback: try to save a minimal state if full save fails
        try {
          const minimalState = { idea: state.idea, style: state.style, scriptData: state.scriptData };
          localStorage.setItem('autoStoryState', JSON.stringify(minimalState));
        } catch (innerE) {
          console.error('Critical failure saving state:', innerE);
        }
      }
    }
  }, [state, isLoaded]);

  const updateState = (updates: Partial<AutoStoryState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      stateRef.current = newState;
      return newState;
    });
  };

  // Extract the last frame of a video as base64 for continuity reference
  const extractLastFrame = (videoUrl: string): Promise<{ data: string; mimeType: string } | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);

        const cleanup = () => {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
            if (video.parentNode) video.parentNode.removeChild(video);
          } catch (_) {}
        };

        video.onloadedmetadata = () => {
          // Seek to 500ms before end to get last meaningful frame
          video.currentTime = Math.max(0, video.duration - 0.5);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            if (!ctx) { cleanup(); resolve(null); return; }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
            cleanup();
            resolve({ data, mimeType: 'image/jpeg' });
          } catch (e) {
            console.warn('[lastFrame] Canvas extract failed:', e);
            cleanup();
            resolve(null);
          }
        };

        video.onerror = () => { cleanup(); resolve(null); };
        setTimeout(() => { cleanup(); resolve(null); }, 10000); // safety timeout

        video.src = videoUrl;
        video.load();
      } catch (e) {
        resolve(null);
      }
    });
  };

  const generateSceneWithRetry = async (
    prompt: string,
    aspectRatio: AspectRatio,
    model: string,
    maxRetries = 5
  ) => {
    let attempt = 0;
    const backoffDelays = [25000, 45000, 70000, 120000, 180000];

    while (attempt <= maxRetries) {
      try {
        const operation = await generateVideo(prompt, undefined, undefined, aspectRatio, '720p', model);
        const url = await pollVideoOperation(operation);
        return url;
      } catch (error: any) {
        console.error(`Generation failed (Attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        
        const errorMsg = error?.message?.toLowerCase() || (typeof error === 'string' ? error.toLowerCase() : '');
        const isQuotaError = errorMsg.includes('quota') || errorMsg.includes('429') || error?.status === 429 || error?.code === 429 || errorMsg.includes('too many requests');

        if (attempt === maxRetries) {
          throw new Error(isQuotaError ? "API Quota exceeded after multiple retries." : errorMsg);
        }

        const delay = isQuotaError ? backoffDelays[attempt] : 5000;
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
    // Track last generated frame for character continuity
    let previousSceneLastFrame: { data: string; mimeType: string } | undefined = undefined;

    try {
      while (true) {
        if (myGenerationId !== currentGenerationId) break;
        const currentState = stateRef.current;
        if (!currentState.isGeneratingVideos) break;

        // Find the next scene to process
        let sceneIndexToProcess = -1;
        
        for (let i = 0; i < currentState.scenesState.length; i++) {
          const scene = currentState.scenesState[i];
          if (scene.status === 'queued' || (scene.loading && !scene.url && !scene.error)) {
            sceneIndexToProcess = i;
            break;
          }
        }
        
        if (sceneIndexToProcess === -1) {
          updateState({ isGeneratingVideos: false });
          break;
        }

        const { scriptData, aspectRatio, veoModel } = currentState;
        if (!scriptData) break;

        const scene = scriptData.scenes[sceneIndexToProcess];

        // Build character consistency prefix — inject all character descriptions into every prompt
        const characterPrefix = scriptData.characters && scriptData.characters.length > 0
          ? scriptData.characters.map(c => `${c.name}: ${c.description}`).join('. ') + '. Maintain consistent character appearance throughout. '
          : '';
        const characterLock = currentState.characterStyle ? `Character style lock: ${currentState.characterStyle}. ` : '';
        // Use scene's customPrompt if set (from reprompt), otherwise use original
        const sceneCustomPrompt = currentState.scenesState[sceneIndexToProcess]?.customPrompt;
        const fullPrompt = characterLock + characterPrefix + (sceneCustomPrompt || scene.prompt);

        // Mark as processing
        setState(prev => {
          const newScenes = [...prev.scenesState];
          newScenes[sceneIndexToProcess] = {
            ...newScenes[sceneIndexToProcess],
            loading: true,
            status: 'processing'
          };
          return { ...prev, scenesState: newScenes };
        });

        try {
          const url = await generateSceneWithRetry(fullPrompt, aspectRatio, veoModel);
          if (myGenerationId !== currentGenerationId) break;

          // Extract last frame of this scene to use as reference for next scene
          extractLastFrame(url).then(frame => {
            if (frame) previousSceneLastFrame = frame;
          });

          // Auto-save each scene video and capture Supabase permanent URL
          const savedUrl = await saveToStudioGallery({
            type: 'video',
            url,
            prompt: scene.prompt,
            settings: { source: 'auto-story-scene', index: sceneIndexToProcess, model: veoModel }
          });

          setState(prev => {
            const newScenes = [...prev.scenesState];
            newScenes[sceneIndexToProcess] = {
              ...newScenes[sceneIndexToProcess],
              loading: false,
              url,
              // Use permanent Supabase URL for assembly (avoids Veo URL expiry/CORS)
              savedUrl: savedUrl || url,
              resolution: '720p', status: 'done'
            };
            const newState = { ...prev, scenesState: newScenes };
            
            const totalTasks = prev.scriptData?.scenes.length || 0;
            const completedTasks = newState.scenesState.filter(s => s.status === 'done' || s.status === 'error').length;
            newState.generationProgress = { current: completedTasks, total: totalTasks };
            
            stateRef.current = newState;
            return newState;
          });
        } catch (error: any) {
          if (myGenerationId !== currentGenerationId) break;
          const errorMsg = error?.message || 'Generation failed';

          setState(prev => {
            const newScenes = [...prev.scenesState];
            newScenes[sceneIndexToProcess] = { 
              ...newScenes[sceneIndexToProcess],
              loading: false, error: errorMsg, status: 'error' 
            };
            const newState = { ...prev, scenesState: newScenes };
            
            const totalTasks = prev.scriptData?.scenes.length || 0;
            const completedTasks = newState.scenesState.filter(s => s.status === 'done' || s.status === 'error').length;
            newState.generationProgress = { current: completedTasks, total: totalTasks };
            
            stateRef.current = newState;
            return newState;
          });
        }
        
        if (myGenerationId !== currentGenerationId) break;
        // Small delay between scenes to protect quota
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    } finally {
      if (myGenerationId === currentGenerationId) {
        isSequentialLoopRunning = false;
      }
    }
  };

  const generateWorkflow = async (videoFile?: File) => {
    currentGenerationId++;
    const { inputType, idea, style, sceneCount, language } = state;
    if (inputType === 'text' && !idea) return;
    if (inputType === 'video' && !videoFile) return;
    
    updateState({
      scriptData: null,
      scenesState: [],
      finalVideo: null,
      assemblyError: null,
      activeTab: 'script',
      isGeneratingScript: true
    });
    
    try {
      let data;
      if (inputType === 'text') {
        data = await generateAutoScript(idea, style, sceneCount, language);
      } else {
        const frames = await extractFrames(videoFile!, sceneCount * 2);
        data = await generateScriptFromVideo(frames, style, sceneCount, language);
      }
      
      const initialScenes: SceneState[] = data.scenes.map(() => ({ 
        loading: false, 
        status: 'queued',
        audioLoading: language !== 'none'
      }));
      
      updateState({
        scriptData: data,
        scenesState: initialScenes,
        isGeneratingScript: false,
        isGeneratingVideos: true,
        activeTab: 'videos',
        generationProgress: { current: 0, total: data.scenes.length }
      });
      
      // Start sequential video generation
      setTimeout(processQueue, 0);

      // Generate Audio sequentially and upload to Supabase for persistence
      for (let sceneIndex = 0; sceneIndex < data.scenes.length; sceneIndex++) {
        const scene = data.scenes[sceneIndex];
        if (language !== 'none' && scene.narration) {
          try {
            const blobUrl = await generateSpeech(scene.narration, language);
            // Upload to Supabase so URL stays valid after long video generation
            let audioUrl = blobUrl;
            try {
              const audioRes = await fetch(blobUrl);
              const audioBlob = await audioRes.blob();
              const audioFilename = `audio/autostory-scene-${sceneIndex}-${Date.now()}.wav`;
              const { error: uploadErr } = await supabase.storage
                .from('studio-media')
                .upload(audioFilename, audioBlob, { contentType: 'audio/wav', upsert: true });
              if (!uploadErr) {
                const { data: { publicUrl } } = supabase.storage.from('studio-media').getPublicUrl(audioFilename);
                audioUrl = publicUrl;
              }
            } catch (_) { /* keep blob URL as fallback */ }
            setState(prev => {
              const newScenes = [...prev.scenesState];
              newScenes[sceneIndex] = { ...newScenes[sceneIndex], audioLoading: false, audioUrl };
              return { ...prev, scenesState: newScenes };
            });
          } catch (err: any) {
            let errorMsg = err?.message || (typeof err === 'string' ? err : 'Unknown error');

            // Try to parse JSON error if it's a stringified JSON
            try {
              if (typeof errorMsg === 'string' && errorMsg.includes('{')) {
                const json = JSON.parse(errorMsg.substring(errorMsg.indexOf('{')));
                if (json.error?.message) errorMsg = json.error.message;
              }
            } catch (e) {}

            if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429') || err?.status === 429 || err?.code === 429) {
              errorMsg = 'API Quota Exceeded. Please click the "Key" icon to select your own Gemini API key for higher limits.';
            }
            setState(prev => {
              const newScenes = [...prev.scenesState];
              newScenes[sceneIndex] = { ...newScenes[sceneIndex], audioLoading: false, audioError: `TTS Scene ${sceneIndex + 1} failed: ${errorMsg}` };
              return { ...prev, scenesState: newScenes };
            });

            if (errorMsg.includes('Quota Exceeded')) {
              break;
            }
          }
          // Add a small delay between audio generations
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
    } catch (error: any) {
      console.error("Workflow failed:", error);
      let errorMsg = error?.message || (typeof error === 'string' ? error : 'Failed to generate workflow');
      
      // Try to parse JSON error if it's a stringified JSON
      try {
        if (typeof errorMsg === 'string' && errorMsg.includes('{')) {
          const json = JSON.parse(errorMsg.substring(errorMsg.indexOf('{')));
          if (json.error?.message) errorMsg = json.error.message;
        }
      } catch (e) {}

      if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429') || error?.status === 429 || error?.code === 429) {
        errorMsg = 'API Quota Exceeded. Please click the "Key" icon to select your own Gemini API key for higher limits.';
      }
      updateState({ isGeneratingScript: false, isGeneratingVideos: false, workflowError: errorMsg });
    }
  };

  const retryVariant = (sceneIndex: number) => {
    // Allow retry if either AI Studio key or custom key is available
    if (!stateRef.current.hasApiKey && !customApiKey) {
      openKeySelection();
      return;
    }
    // Increment id to break any running loop, then force-reset the lock
    currentGenerationId++;
    isSequentialLoopRunning = false; // Fix: finally block won't reset when id changes

    setState(prev => {
      const newScenes = [...prev.scenesState];
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading: false, status: 'queued', error: undefined, url: undefined };
      const newState = { ...prev, scenesState: newScenes, isGeneratingVideos: true };
      const totalTasks = prev.scriptData?.scenes.length || 0;
      const completedTasks = newState.scenesState.filter(s => s.status === 'done' || s.status === 'error').length;
      newState.generationProgress = { current: completedTasks, total: totalTasks };
      stateRef.current = newState;
      return newState;
    });

    // Small delay so setState flushes before processQueue reads stateRef
    setTimeout(processQueue, 100);
  };

  const upscaleVariant = async (sceneIndex: number) => {
    if (!state.hasApiKey && !customApiKey) {
      openKeySelection();
      return;
    }
    const { scriptData, aspectRatio } = state;
    if (!scriptData) return;
    const scene = scriptData.scenes[sceneIndex];
    
    setState(prev => {
      const newScenes = [...prev.scenesState];
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], isUpscaling: true };
      return { ...prev, scenesState: newScenes };
    });

    try {
      const operation = await generateVideo(scene.prompt, undefined, undefined, aspectRatio, '1080p');
      const url = await pollVideoOperation(operation);
      
      setState(prev => {
        const newScenes = [...prev.scenesState];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading: false, url, isUpscaling: false, resolution: '1080p', status: 'done' };
        return { ...prev, scenesState: newScenes };
      });
    } catch (error: any) {
      let errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      updateState({ workflowError: `Failed to upscale scene ${sceneIndex + 1}: ${errorMsg}` });
      setState(prev => {
        const newScenes = [...prev.scenesState];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], isUpscaling: false };
        return { ...prev, scenesState: newScenes };
      });
    }
  };

  const assembleVideo = async () => {
    const { scenesState, scriptData, showSubtitles } = state;
    const scenesToMerge = scenesState.map((s, i) => {
      // Prefer permanent Supabase URL (CORS-safe, never expires) over raw Veo URL
      const rawUrl = s.activeVariant === 2 && s.url2 ? s.url2 : s.url;
      const savedUrl = s.activeVariant === 2 && s.savedUrl2 ? s.savedUrl2 : s.savedUrl;
      return {
        videoUrl: savedUrl || rawUrl,
        audioUrl: s.audioUrl,
        subtitle: scriptData?.scenes[i]?.narration
      };
    }).filter(s => s.videoUrl) as { videoUrl: string, audioUrl?: string; subtitle?: string }[];
    
    if (scenesToMerge.length === 0) return;

    updateState({ isAssembling: true, assemblyProgress: 0, assemblyError: null });
    
    try {
      const finalUrl = await concatVideos(scenesToMerge, (progress) => {
        updateState({ assemblyProgress: Math.round(progress * 100) });
      }, showSubtitles);
      updateState({ finalVideo: finalUrl, isAssembling: false, assemblyProgress: 100 });

      // Auto-save final assembled master video
      saveToStudioGallery({
        type: 'video',
        url: finalUrl,
        prompt: `Auto Story master for idea: ${state.idea}`,
        settings: { source: 'auto-story-master', style: state.style, sceneCount: state.sceneCount }
      });
    } catch (error: any) {
      console.error('Failed to assemble video:', error);
      updateState({ isAssembling: false, assemblyError: error.message || 'Unknown error during assembly' });
    }
  };

  const reset = () => {
    currentGenerationId++;
    setState(initialState);
    stateRef.current = initialState;
    localStorage.removeItem('autoStoryState');
    isSequentialLoopRunning = false;
  };

  const openKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      const hasKey = await window.aistudio.hasSelectedApiKey();
      updateState({ hasApiKey: hasKey });
    } else {
      // Standalone app: go to Settings to enter a custom API key
      window.location.href = '/settings';
    }
  };

  const openDirectoryPicker = async () => {
    try {
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        if (confirm("Browser security prevents folder selection inside this preview window. Open the app in a new tab to use this feature?")) {
          window.open(window.location.href, '_blank');
        }
        return;
      }

      // @ts-ignore
      if (typeof window.showDirectoryPicker === 'function') {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // We need to communicate with SettingsContext or just update local state if we had it
        // For now, let's at least trigger the success message
        alert("Folder selected: " + handle.name);
      } else {
        alert("Your browser doesn't support direct folder selection.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert("Folder selection failed.");
      }
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

  const repromptScene = (sceneIndex: number, customPrompt: string) => {
    if (!stateRef.current.hasApiKey && !customApiKey) {
      openKeySelection();
      return;
    }
    currentGenerationId++;
    isSequentialLoopRunning = false;

    setState(prev => {
      const newScenes = [...prev.scenesState];
      newScenes[sceneIndex] = {
        ...newScenes[sceneIndex],
        customPrompt,
        loading: false,
        status: 'queued',
        error: undefined,
        url: undefined,
        url2: undefined,
        activeVariant: 1,
      };
      const newState = { ...prev, scenesState: newScenes, isGeneratingVideos: true };
      const totalTasks = prev.scriptData?.scenes.length || 0;
      const completedTasks = newState.scenesState.filter(s => s.status === 'done' || s.status === 'error').length;
      newState.generationProgress = { current: completedTasks, total: totalTasks };
      stateRef.current = newState;
      return newState;
    });

    setTimeout(processQueue, 100);
  };

  const generateAltVariant = async (sceneIndex: number) => {
    if (!stateRef.current.hasApiKey && !customApiKey) {
      openKeySelection();
      return;
    }
    const { scriptData, aspectRatio, veoModel, characterStyle } = stateRef.current;
    if (!scriptData) return;

    const scene = scriptData.scenes[sceneIndex];
    const sceneState = stateRef.current.scenesState[sceneIndex];

    setState(prev => {
      const newScenes = [...prev.scenesState];
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading2: true, error2: undefined };
      return { ...prev, scenesState: newScenes };
    });

    try {
      const characterPrefix = scriptData.characters && scriptData.characters.length > 0
        ? scriptData.characters.map(c => `${c.name}: ${c.description}`).join('. ') + '. Maintain consistent character appearance throughout. '
        : '';
      const characterLock = characterStyle ? `Character style lock: ${characterStyle}. ` : '';
      const fullPrompt = characterLock + characterPrefix + (sceneState.customPrompt || scene.prompt);

      const url2 = await generateSceneWithRetry(fullPrompt, aspectRatio, veoModel);

      const savedUrl2 = await saveToStudioGallery({
        type: 'video', url: url2,
        prompt: fullPrompt,
        settings: { source: 'auto-story-variant2', index: sceneIndex, model: veoModel }
      });

      setState(prev => {
        const newScenes = [...prev.scenesState];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading2: false, url2, savedUrl2: savedUrl2 || url2, activeVariant: 2 };
        stateRef.current = { ...prev, scenesState: newScenes };
        return stateRef.current;
      });
    } catch (error: any) {
      setState(prev => {
        const newScenes = [...prev.scenesState];
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], loading2: false, error2: error?.message || 'Alt generation failed' };
        return { ...prev, scenesState: newScenes };
      });
    }
  };

  const switchVariant = (sceneIndex: number, variant: 1 | 2) => {
    setState(prev => {
      const newScenes = [...prev.scenesState];
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], activeVariant: variant };
      return { ...prev, scenesState: newScenes };
    });
  };

    return (
    <AutoStoryContext.Provider value={{
      ...state,
      setInputType: (type) => updateState({ inputType: type }),
      setIdea: (idea) => updateState({ idea }),
      setStyle: (style) => updateState({ style }),
      setSceneCount: (count) => updateState({ sceneCount: count }),
      setLanguage: (lang) => updateState({ language: lang }),
      setAspectRatio: (ratio) => updateState({ aspectRatio: ratio }),
      setVeoModel: (model) => updateState({ veoModel: model }),
      setActiveTab: (tab) => updateState({ activeTab: tab }),
      generateWorkflow,
      retryVariant,
      upscaleVariant,
      assembleVideo,
      reset,
      setShowSubtitles: (show) => updateState({ showSubtitles: show }),
      openKeySelection,
      checkApiKey,
      openDirectoryPicker,
      setCharacterStyle: (style) => updateState({ characterStyle: style }),
      repromptScene,
      generateAltVariant,
      switchVariant,
    }}>
      {children}
    </AutoStoryContext.Provider>
  );
};

export const useAutoStory = () => {
  const context = useContext(AutoStoryContext);
  if (!context) throw new Error('useAutoStory must be used within AutoStoryProvider');
  return context;
};
