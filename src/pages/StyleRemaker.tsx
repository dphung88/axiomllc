import React, { useState, useEffect, useRef } from 'react';
import { Upload, Wand2, Loader2, Play, CheckCircle2, Video, RefreshCw, AlertCircle, Film, Download, Terminal, Layers, Sparkles, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractFrames, analyzeVideoScenes } from '../services/geminiService';
import { useRemaker } from '../context/RemakerContext';
import { useSettings } from '../context/SettingsContext';
import { getApiKey, getLlmModel } from '../services/apiConfig';
import { GoogleGenAI } from '@google/genai';
import { fetchAndDownload, downloadFile } from '../utils/downloadHelper';

const STYLES = [
  'Cartoon', '2D Flat', 'Anime', 'Stop Motion', 'Noir', 'Pixel Art', 
  'Oil Painting', 'Cyberpunk', 'Sketch', 'Watercolor', 'Custom'
];

function ElapsedTime({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="text-xs text-cyan-400 ml-2 font-mono">({elapsed}s)</span>;
}

export function StyleRemaker() {
  const { projectName, directoryHandle } = useSettings();
  const {
    step, setStep,
    originalVideoUrl, setOriginalVideoUrl,
    videoDuration, setVideoDuration,
    targetSceneCount, setTargetSceneCount,
    scenes, setScenes,
    selectedStyle, setSelectedStyle,
    customStyle, setCustomStyle,
    aspectRatio, setAspectRatio,
    veoModel, setVeoModel,
    isGenerating, remadeScenes,
    finalVideo, isAssembling, assemblyProgress,
    logs,
    startGeneration, reGenerateAll, retryVariant, assembleFinalVideo, reset, showToast,
    openKeySelection, repromptScene, repromptSceneWithPrompt, addLog,
    characterStyle, setCharacterStyle
  } = useRemaker();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  // Re-prompt modal state
  const [repromptModal, setRepromptModal] = useState<{ open: boolean; index: number; text: string }>({ open: false, index: 0, text: '' });
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (finalVideo) {
      setShowFinalModal(true);
    }
  }, [finalVideo]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    addLog(`Uploaded video file: ${file.name}`, 'info');
    const url = URL.createObjectURL(file);
    setOriginalVideoUrl(url);
    
    // Get duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      setVideoDuration(duration);
      const recommendedCount = Math.min(20, Math.max(5, Math.ceil(duration / 6)));
      setTargetSceneCount(recommendedCount);
      setStep(2);
      addLog(`Video duration: ${duration.toFixed(2)}s. Recommended scenes: ${recommendedCount}`, 'info');
    };
    video.src = url;
  };

  const analyzeVideo = async () => {
    if (!originalVideoUrl) {
      addLog('Error: No source video URL found.', 'error');
      return;
    }
    
    setIsAnalyzing(true);
    addLog('Starting Video Analysis Phase...', 'info');
    
    try {
      addLog(`Downloading source video from ${originalVideoUrl.substring(0, 30)}...`, 'info');
      const response = await fetch(originalVideoUrl);
      if (!response.ok) throw new Error(`Network error while fetching video: ${response.statusText}`);
      
      const blob = await response.blob();
      addLog(`Video blob received (${Math.round(blob.size / 1024)} KB).`, 'info');
      
      const file = new File([blob], "video.mp4", { type: blob.type });
      
      addLog(`Extracting ${targetSceneCount * 2} frames for AI analysis...`, 'info');
      const frames = await extractFrames(file, targetSceneCount * 2);
      addLog(`Successfully extracted ${frames.length} frames.`, 'success');
      
      addLog('Sending visual data to Gemini 2.0 Flash...', 'info');
      const extractedScenes = await analyzeVideoScenes(frames, targetSceneCount);
      
      if (!extractedScenes || !Array.isArray(extractedScenes) || extractedScenes.length === 0) {
        throw new Error("AI returned an invalid or empty scene list.");
      }

      addLog(`AI Analysis complete. Processing ${extractedScenes.length} scenes.`, 'info');

      // Final validation of scene object structure
      const validatedScenes = extractedScenes.map((s, idx) => ({
        sceneNumber: s.sceneNumber || idx + 1,
        action: s.action || "No action described",
        characters: s.characters || "None",
        setting: s.setting || "Default environment",
        mood: s.mood || "Neutral"
      }));

      addLog(`Validation successful. Decomposed into ${validatedScenes.length} scenes.`, 'success');
      setScenes(validatedScenes);
      setStep(3);
    } catch (error: any) {
      console.error("StyleRemaker Analysis Failed:", error);
      let errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      
      if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        addLog('Error: Gemini API Quota Exceeded (429). Please wait 60s.', 'error');
        showToast('Gemini API Quota Exceeded. Try again in 1 minute.');
      } else if (errorMsg.includes('timeout')) {
        addLog('Error: Video processing timed out. Browser memory might be low.', 'error');
        showToast('Video processing timed out. Try a smaller file.');
      } else if (errorMsg.includes('format') || errorMsg.includes('parse')) {
        addLog('Error: AI response format was invalid. JSON parsing failed.', 'error');
        showToast('AI response format error. Retrying might fix it.');
      } else if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        addLog(`Network Error: ${errorMsg}`, 'error');
      } else {
        addLog(`System Error: ${errorMsg}`, 'error');
        showToast(`Analysis error: ${errorMsg.substring(0, 50)}...`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeVideoDirectly = async () => {
    if (!originalVideoUrl) return;
    setIsAnalyzing(true);
    addLog('Experimental: Analyzing video as a single file...', 'info');
    try {
      const response = await fetch(originalVideoUrl);
      const blob = await response.blob();
      
      if (blob.size > 15 * 1024 * 1024) {
         addLog('Video is too large (>15MB) for direct analysis. Using frame extraction instead...', 'warn');
         return analyzeVideo();
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(blob);
      const base64Video = await base64Promise;

      addLog('Sending video to Gemini 2.0 Flash...', 'info');
      
      const apiKey = getApiKey();
      const model = getLlmModel();
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Analyze this video. Break it down into exactly ${targetSceneCount} distinct scenes.
      Return ONLY a JSON array of ${targetSceneCount} objects. 
      Format: [{"sceneNumber": 1, "action": "...", "characters": "...", "setting": "...", "mood": "..."}, ...]`;

      const result = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: blob.type || 'video/mp4', data: base64Video } },
          { text: prompt }
        ] }]
      });

      const jsonResult = result.text || (result.candidates?.[0]?.content?.parts?.[0]?.text);
      if (!jsonResult) throw new Error("Empty AI response");

      // Reuse the same parsing logic
      const cleanJson = (text: string) => {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? jsonMatch[0] : text;
      };

      const validatedScenes = JSON.parse(cleanJson(jsonResult));
      setScenes(validatedScenes);
      setStep(3);
      addLog('Direct analysis successful!', 'success');
    } catch (error: any) {
      addLog(`Direct analysis failed: ${error.message}. Retrying with frames...`, 'warn');
      return analyzeVideo();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadAllClips = async () => {
    addLog('Downloading all selected clips...', 'info');
    for (let i = 0; i < remadeScenes.length; i++) {
      const scene = remadeScenes[i];
      if (!scene.url) continue;
      try {
        const filename = `remaker_scene_${String(i + 1).padStart(2, '0')}.mp4`;
        await fetchAndDownload(scene.url, filename, directoryHandle);
      } catch (err) {
        console.warn(`Failed to download scene ${i + 1}:`, err);
      }
    }
    addLog('Clips downloaded successfully.', 'success');
  };

  const downloadMaster = async () => {
    if (!finalVideo) return;
    addLog('Downloading master video...', 'info');
    try {
      if (finalVideo.startsWith('blob:')) {
        // blob: URL — fetch as blob directly
        const res = await fetch(finalVideo);
        const blob = await res.blob();
        await downloadFile(blob, `remaker_master_${Date.now()}.mp4`, directoryHandle);
      } else {
        await fetchAndDownload(finalVideo, `remaker_master_${Date.now()}.mp4`, directoryHandle);
      }
      addLog('Master downloaded successfully.', 'success');
    } catch (err) {
      console.error('Download master failed:', err);
      addLog('Master download failed.', 'error');
    }
  };

  const allScenesGenerated = remadeScenes.length > 0 && remadeScenes.every(s => s.status === 'done');
  
  let currentGeneratingScene = -1;
  for (let i = 0; i < remadeScenes.length; i++) {
    if (remadeScenes[i].loading) {
      currentGeneratingScene = i;
      break;
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-12 max-w-[1600px] mx-auto"
    >
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-[2px] w-12 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
              <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Visual Re-imagination</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
              Style <span className="text-cyan-500">Remaker</span>
            </h1>
            <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
              Transform your footage through the lens of advanced AI. Re-imagine every frame with cinematic precision.
            </p>
          </div>
          <div className="pt-4">
            <button
              onClick={reset}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all border border-zinc-800 text-xs group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              NEW GENERATION
            </button>
          </div>
        </div>

      {/* Progress Stepper */}
      <div className="flex items-center gap-6 mb-20 overflow-x-auto hide-scrollbar pb-10 px-2">
        {[
          { num: 1, label: 'Upload', icon: Upload },
          { num: 2, label: 'Analyze', icon: Play },
          { num: 3, label: 'Style', icon: Sparkles },
          { num: 4, label: 'Render', icon: Film }
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-5 shrink-0 group">
              <div className="relative">
                <div className={`relative flex items-center justify-center w-16 h-16 rounded-[1.25rem] font-black text-xl transition-all duration-700 ${
                  step === s.num 
                    ? 'bg-cyan-500 text-black shadow-[0_0_40px_rgba(6,182,212,0.6)] scale-110 border border-cyan-400/50' 
                    : step > s.num 
                      ? 'bg-zinc-800/80 text-cyan-400 border border-cyan-500/30' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  {step > s.num ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <s.icon className="w-7 h-7" />
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 ${step === s.num ? 'text-cyan-500' : 'text-zinc-600'}`}>Phase 0{s.num}</span>
                <span className={`font-black text-base tracking-widest uppercase whitespace-nowrap ${step === s.num ? 'text-white' : 'text-zinc-700'}`}>{s.label}</span>
              </div>
            </div>
            {i < 3 && <div className="relative w-16 h-[2px] mx-2 bg-zinc-800" />}
          </React.Fragment>
        ))}
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] p-10 shadow-3xl"
          >
            {step === 1 && (
              <div className="text-center py-24">
                <div className="relative w-32 h-32 mx-auto mb-12 group">
                  <div className="absolute inset-0 border border-dashed border-cyan-500/40 rounded-full group-hover:border-cyan-500 transition-all cursor-pointer">
                    <input type="file" accept="video/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <Upload className="w-12 h-12 text-cyan-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <h3 className="text-5xl font-black text-white font-sans uppercase tracking-tighter mb-6">Source Ingestion</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Inject a video sequence for AI structural decomposition.</p>
              </div>
            )}

            {step === 2 && originalVideoUrl && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Video className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Source Footage</h3>
                  </div>
                  <div className="relative rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl aspect-video bg-black">
                    <video src={originalVideoUrl} controls className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 bg-zinc-950/50 rounded-3xl border border-zinc-800/50">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Scene Density</h4>
                      <span className="bg-cyan-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{targetSceneCount} Scenes</span>
                    </div>
                    <input 
                      type="range" min="5" max="20" value={targetSceneCount} 
                      onChange={(e) => setTargetSceneCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeVideoDirectly}
                      disabled={isAnalyzing}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center gap-3 transition-all w-full justify-center shadow-2xl mt-8"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      {isAnalyzing ? 'ANALYZING FOOTAGE...' : 'BEGIN ANALYSIS'}
                    </motion.button>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Analysis Engine Logs</span>
                  </div>
                  <div className="bg-black/40 border border-zinc-800 rounded-3xl p-6 h-[400px] overflow-y-auto font-mono text-[10px] space-y-2 scrollbar-thin">
                    {logs.length === 0 ? (
                      <div className="text-zinc-700 italic">Waiting for analysis start...</div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className={`flex gap-3 leading-relaxed border-l-2 pl-3 ${
                          log.type === 'error' ? 'text-red-400 border-red-500/50' : 
                          log.type === 'success' ? 'text-cyan-400 border-cyan-500/50' : 
                          'text-zinc-500 border-zinc-800'
                        }`}>
                          <span className="opacity-30 shrink-0 font-bold">[{log.time}]</span>
                          <span className="break-words">{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scenes.map((scene, i) => (
                    <div key={i} className="bg-zinc-950/50 p-6 rounded-3xl border border-zinc-800/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em]">Scene {i + 1}</div>
                        <button
                          onClick={() => repromptScene(i)}
                          className="flex items-center gap-1 text-[9px] font-black text-amber-400 hover:text-amber-200 uppercase tracking-wider border border-amber-500/30 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                          title="Let AI improve this scene's prompt"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> AI Improve
                        </button>
                      </div>
                      <div className="space-y-4">
                        <textarea
                          value={scene.action || ''}
                          onChange={(e) => {
                            const newScenes = [...scenes];
                            newScenes[i] = { ...scene, action: e.target.value };
                            setScenes(newScenes);
                          }}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50 resize-none h-20"
                          placeholder="Action..."
                        />
                        <input
                          type="text" value={scene.characters || ''}
                          onChange={(e) => {
                            const newScenes = [...scenes];
                            newScenes[i] = { ...scene, characters: e.target.value };
                            setScenes(newScenes);
                          }}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300"
                          placeholder="Characters..."
                        />
                        <input
                          type="text" value={scene.mood || ''}
                          onChange={(e) => {
                            const newScenes = [...scenes];
                            newScenes[i] = { ...scene, mood: e.target.value };
                            setScenes(newScenes);
                          }}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-cyan-400/80 italic"
                          placeholder="Mood..."
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Style & Generation Config */}
                  <div className="lg:col-span-2 p-8 bg-zinc-950/50 rounded-[2rem] border border-zinc-800/50">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Visual Style & Generation</h3>
                    <div className="flex flex-wrap gap-3 mb-10">
                      {STYLES.map(style => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyle(style)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                            selectedStyle === style ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                    {/* Character consistency */}
                    <div className="mb-6">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Character Consistency (optional)</label>
                      <input
                        type="text"
                        value={characterStyle}
                        onChange={e => setCharacterStyle(e.target.value)}
                        placeholder="e.g. Young woman, red hair, blue jacket — applied to all scenes"
                        className="w-full bg-zinc-900/60 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={startGeneration}
                        disabled={isGenerating}
                        className="bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-[0.2em] py-5 px-10 rounded-2xl flex items-center gap-4 transition-all shadow-2xl"
                      >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isGenerating ? 'GENERATING...' : 'START GENERATION'}
                      </button>
                    </div>
                  </div>

                  {/* System Logs */}
                  <div className="lg:col-span-1 flex flex-col bg-black/40 border border-zinc-800/50 rounded-[2rem] overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/40">
                      <Terminal className="w-4 h-4 text-cyan-500" />
                      <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">System Logs</span>
                      <div className="ml-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 font-mono text-[10px] space-y-2 hide-scrollbar min-h-[200px]">
                      {logs.length === 0 ? (
                        <div className="text-zinc-700 italic">Awaiting operations...</div>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className={`flex gap-3 leading-relaxed border-l-2 pl-3 ${
                            log.type === 'error' ? 'text-red-400 border-red-500/50' :
                            log.type === 'success' ? 'text-cyan-400 border-cyan-500/50' :
                            'text-zinc-500 border-zinc-800'
                          }`}>
                            <span className="opacity-30 shrink-0 font-bold">[{log.time}]</span>
                            <span className="break-words">{log.message}</span>
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8">
                {/* Top row: Preview + Scene Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Preview */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Preview Results</h3>
                    <div className="aspect-video bg-black rounded-[2rem] overflow-hidden border border-zinc-800">
                      {finalVideo ? (
                        <video src={finalVideo} controls autoPlay loop className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700">
                          <Loader2 className="w-10 h-10 animate-spin mb-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Assembling Master...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scene Status */}
                  <div className="bg-black/20 p-8 rounded-[2rem] border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">System Status</h3>
                      {remadeScenes.length > 0 && (
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          {remadeScenes.filter(s => s.status === 'done').length}
                          <span className="text-zinc-600"> / {remadeScenes.length}</span>
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {remadeScenes.length > 0 && (
                      <div className="mb-5">
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-700"
                            style={{ width: `${(remadeScenes.filter(s => s.status === 'done').length / remadeScenes.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 overflow-y-auto max-h-[260px] hide-scrollbar pr-1">
                      {remadeScenes.map((s, i) => {
                        const isProcessing = s.status === 'processing';
                        const isQueued    = s.status === 'queued';
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              isProcessing
                                ? 'bg-cyan-950/30 border-cyan-500/40'
                                : s.status === 'done'
                                  ? 'bg-emerald-950/20 border-emerald-500/20'
                                  : s.status === 'error'
                                    ? 'bg-red-950/20 border-red-500/20'
                                    : 'bg-zinc-900/50 border-zinc-800'
                            }`}
                          >
                            {/* Left: scene label + status badge */}
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black uppercase ${isProcessing ? 'text-cyan-400' : 'text-zinc-500'}`}>
                                Scene {i + 1}
                              </span>
                              {isProcessing && (
                                <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 animate-pulse">
                                  Generating
                                </span>
                              )}
                              {isQueued && (
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-800/50 px-2 py-0.5 rounded-full">
                                  Queued
                                </span>
                              )}
                            </div>

                            {/* Right: timer / icon */}
                            <div className="flex items-center gap-2">
                              {isProcessing && s.startTime && <ElapsedTime startTime={s.startTime} />}
                              {s.status === 'done' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setRepromptModal({ open: true, index: i, text: s.customPrompt || '' })}
                                    className="flex items-center gap-1 text-[9px] font-black text-amber-400 hover:text-amber-200 uppercase tracking-wider border border-amber-500/30 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                                    title="Re-prompt this scene"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" /> Re-prompt
                                  </button>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </div>
                              ) : s.status === 'error' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setRepromptModal({ open: true, index: i, text: s.customPrompt || '' })}
                                    className="flex items-center gap-1 text-[9px] font-black text-amber-400 hover:text-amber-200 uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-lg cursor-pointer"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" /> Re-prompt
                                  </button>
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  <button
                                    onClick={() => retryVariant(i)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-red-400 hover:text-red-200 uppercase tracking-wider border border-red-500/40 bg-red-500/10 px-3 py-1 rounded-lg transition-all cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Retry
                                  </button>
                                </div>
                              ) : isProcessing ? (
                                <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    {allScenesGenerated && (
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <button
                          onClick={assembleFinalVideo}
                          disabled={isAssembling}
                          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black uppercase tracking-wide py-3 px-3 rounded-xl flex items-center justify-center gap-2 text-[10px] whitespace-nowrap transition-all"
                        >
                          {isAssembling ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Film className="w-4 h-4 shrink-0" />}
                          {isAssembling ? `${assemblyProgress}%` : 'Assemble'}
                        </button>
                        <button
                          onClick={downloadAllClips}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black uppercase tracking-wide py-3 px-3 rounded-xl flex items-center justify-center gap-2 text-[10px] whitespace-nowrap transition-all border border-zinc-700"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          Download Clips
                        </button>
                        {finalVideo && (
                          <button
                            onClick={downloadMaster}
                            className="col-span-2 bg-[#12121e] hover:bg-[#1c1c2e] border border-white/10 hover:border-white/20 text-zinc-500 hover:text-zinc-300 font-black uppercase tracking-[0.2em] py-4 px-3 rounded-xl flex items-center justify-center gap-3 text-[10px] whitespace-nowrap transition-all duration-200"
                          >
                            <Download className="w-4 h-4 shrink-0 opacity-50" />
                            Download Master Video
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom: System Logs (full width) */}
                <div className="bg-black/40 border border-zinc-800/50 rounded-[2rem] overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/40">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Neural Process Output</span>
                    <div className="ml-auto flex items-center gap-3">
                      {isGenerating && (
                        <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest animate-pulse">
                          ● Live
                        </span>
                      )}
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 font-mono text-[10px] space-y-2 overflow-y-auto h-[220px] hide-scrollbar">
                    {logs.length === 0 ? (
                      <div className="text-zinc-700 italic">Awaiting neural initialization...</div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className={`flex gap-3 leading-relaxed border-l-2 pl-3 ${
                          log.type === 'error' ? 'text-red-400 border-red-500/50' :
                          log.type === 'success' ? 'text-cyan-400 border-cyan-500/50' :
                          'text-zinc-500 border-zinc-800'
                        }`}>
                          <span className="opacity-30 shrink-0 font-bold">[{log.time}]</span>
                          <span className="break-words">{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Re-prompt Modal */}
      {repromptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Re-prompt Scene {repromptModal.index + 1}</h3>
            <p className="text-xs text-zinc-400 mb-4">Enter a new prompt to regenerate this scene with different content.</p>
            <textarea
              autoFocus
              rows={5}
              value={repromptModal.text}
              onChange={e => setRepromptModal(m => ({ ...m, text: e.target.value }))}
              placeholder="e.g. A cinematic shot of a woman walking through Tokyo streets at night in anime style, neon lights reflecting on wet pavement..."
              className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRepromptModal({ open: false, index: 0, text: '' })}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-all"
              >Cancel</button>
              <button
                onClick={() => {
                  if (repromptModal.text.trim()) {
                    repromptSceneWithPrompt(repromptModal.index, repromptModal.text.trim());
                    setRepromptModal({ open: false, index: 0, text: '' });
                  }
                }}
                disabled={!repromptModal.text.trim()}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black transition-all"
              >Regenerate Scene</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
