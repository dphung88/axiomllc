import React, { useState, useEffect, useRef } from 'react';
import { Upload, Wand2, Loader2, Play, CheckCircle2, ChevronRight, Video, RefreshCw, AlertCircle, Film, Download, Terminal, FolderOpen, FileText, Type, Sparkles, Layers, Zap, X, RotateCcw, Plus, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractFrames, analyzeVideoScenes } from '../services/geminiService';
import { useRemaker } from '../context/RemakerContext';
import { useSettings } from '../context/SettingsContext';
import { GenerationStatus } from '../components/GenerationStatus';

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
  const { projectName, storagePath, customApiKey } = useSettings();
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
    finalVideo, isAssembling, assemblyProgress, assemblyError,
    hasApiKey, logs,
    startGeneration, reGenerateAll, retryVariant, assembleFinalVideo, resumeGeneration, reset, showToast,
    openKeySelection, repromptScene, addLog
  } = useRemaker();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
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
      
      addLog('Sending visual data to Gemini 1.5 Flash...', 'info');
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
>>>>>>> SEARCH
            {step === 2 && originalVideoUrl && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {step === 2 && originalVideoUrl && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-6">
>>>>>>> SEARCH
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeVideo}
                      disabled={isAnalyzing}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center gap-3 transition-all w-full justify-center shadow-2xl"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      {isAnalyzing ? 'ANALYZING FOOTAGE...' : 'BEGIN ANALYSIS'}
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeVideo}
                      disabled={isAnalyzing}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center gap-3 transition-all w-full justify-center shadow-2xl"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      {isAnalyzing ? 'ANALYZING FOOTAGE...' : 'BEGIN ANALYSIS'}
                    </motion.button>
                  </div>
                </div>

                {/* Inline System Logs for Phase 2 */}
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

  const downloadAllClips = () => {
    addLog('Downloading all selected clips...', 'info');
    remadeScenes.forEach((scene, i) => {
      if (scene.url) {
        const a = document.createElement('a');
        a.href = scene.url;
        a.download = `edison-yang-studio_scene_${String(i + 1).padStart(2, '0')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
    addLog('Clips downloaded successfully.', 'success');
  };

  const hasInterruptedGeneration = step === 4 && !isGenerating && !finalVideo && remadeScenes.some(s => !s.url && !s.loading && !s.error);
  const allScenesGenerated = remadeScenes.length > 0 && remadeScenes.every(s => s.status === 'done');
  
  let currentGeneratingScene = -1;
  for (let i = 0; i < remadeScenes.length; i++) {
    if (remadeScenes[i].loading) {
      currentGeneratingScene = i;
      break;
    }
  }

  const totalPrompts = scenes.length;
  const donePrompts = remadeScenes.filter(s => s.status === 'done').length;
  const errorPrompts = remadeScenes.filter(s => s.status === 'error').length;
  const sentPrompts = remadeScenes.filter(s => s.status === 'processing' || s.status === 'done' || s.status === 'error').length;
  const progressPercent = totalPrompts > 0 ? ((donePrompts + errorPrompts) / totalPrompts) * 100 : 0;

  const statusTabs = [
    { id: 'scenes', label: 'Scenes', icon: FileText },
    { id: 'variants', label: 'Variants', icon: Type },
    { id: 'videos', label: 'Videos', icon: Video },
  ];

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
          { num: 2, label: 'Analyze', icon: Zap },
          { num: 3, label: 'Style', icon: Sparkles },
          { num: 4, label: 'Render', icon: Film }
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-5 shrink-0 group">
              <div className="relative">
                {/* Background Mood Glow for Active Step */}
                <AnimatePresence>
                  {step === s.num && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      className="absolute inset-0 bg-cyan-500/20 blur-[30px] rounded-full -z-20 animate-pulse"
                    />
                  )}
                  {step > s.num && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 0.5 }}
                      className="absolute inset-0 bg-cyan-500/10 blur-[20px] rounded-full -z-20"
                    />
                  )}
                </AnimatePresence>

                <div className={`relative flex items-center justify-center w-16 h-16 rounded-[1.25rem] font-black text-xl transition-all duration-700 ${
                  step === s.num 
                    ? 'bg-cyan-500 text-black shadow-[0_0_40px_rgba(6,182,212,0.6)] scale-110 border border-cyan-400/50' 
                    : step > s.num 
                      ? 'bg-zinc-800/80 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  {step > s.num ? (
                    <CheckCircle2 className="w-8 h-8 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                  ) : (
                    <s.icon className={`w-7 h-7 transition-all duration-500 ${
                      step === s.num ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]' : 'group-hover:text-zinc-400'
                    }`} />
                  )}
                  
                  {step === s.num && (
                    <motion.div 
                      layoutId="step-inner-glow"
                      className="absolute inset-0 border-2 border-white/20 rounded-[1.25rem]"
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 transition-colors duration-500 ${
                  step === s.num ? 'text-cyan-500' : 'text-zinc-600'
                }`}>
                  Phase 0{s.num}
                </span>
                <span className={`font-black text-base tracking-widest uppercase whitespace-nowrap transition-all duration-500 ${
                  step === s.num 
                    ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                    : step > s.num 
                      ? 'text-zinc-400' 
                      : 'text-zinc-700'
                }`}>
                  {s.label}
                </span>
              </div>
            </div>
            {i < 3 && (
              <div className="relative w-16 h-[2px] mx-2">
                <div className="absolute inset-0 bg-zinc-800 rounded-full" />
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: step > s.num ? "100%" : "0%" }}
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                  transition={{ duration: 0.8, ease: "circOut" }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "circOut" }}
            className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] p-10 shadow-3xl overflow-hidden relative"
          >
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] -z-10" />
            {step === 1 && (
              <div className="text-center py-24">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative w-32 h-32 mx-auto mb-12 group"
                >
                  {/* Intense Cyan Glow */}
                  <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-3xl group-hover:bg-cyan-500/40 transition-all duration-700 animate-pulse" />
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all duration-500" />
                  
                  {/* Dashed Border Circle */}
                  <div className="absolute inset-0 border border-dashed border-cyan-500/40 rounded-full group-hover:border-cyan-500 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                  
                  {/* Inner Content */}
                  <div className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <input type="file" accept="video/*" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <Upload className="w-12 h-12 text-cyan-500 group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                  </div>
                </motion.div>

                <h3 className="text-5xl font-black text-white font-sans uppercase tracking-tighter mb-6">
                  Source Ingestion
                </h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 max-w-xl mx-auto leading-relaxed opacity-60">
                  Inject a video sequence for AI structural decomposition.
                </p>
              </div>
            )}

            {step === 2 && originalVideoUrl && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Video className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Source Footage</h3>
                  </div>
                  <div className="relative group rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl aspect-video bg-black">
                    <video src={originalVideoUrl} controls className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 bg-zinc-950/50 rounded-3xl border border-zinc-800/50 backdrop-blur-md">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Scene Density</h4>
                      <span className="bg-cyan-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{targetSceneCount} Scenes</span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-6 leading-relaxed font-medium">
                      Your video is <span className="text-zinc-300">{Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60).toString().padStart(2, '0')}</span>. 
                      We recommend <span className="text-cyan-400">{Math.min(20, Math.max(5, Math.ceil(videoDuration / 6)))}</span> scenes for optimal pacing.
                    </p>
                    <div className="relative h-12 flex items-center">
                      <input 
                        type="range" 
                        min="5" 
                        max="20" 
                        value={targetSceneCount} 
                        onChange={(e) => setTargetSceneCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest text-cyan-500/60">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Est. Process Time: ~{targetSceneCount * 3}m</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col justify-center items-center text-center p-10 bg-zinc-950/30 rounded-[2.5rem] border border-zinc-800/50 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-8 mx-auto border border-zinc-800 shadow-xl group-hover:border-cyan-500/30 transition-all duration-500">
                      <Zap className="w-10 h-10 text-cyan-500 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <h3 className="text-3xl font-black text-white font-sans uppercase tracking-tighter mb-4">Gemini Analysis</h3>
                    <p className="text-zinc-400 mb-10 font-medium leading-relaxed max-w-sm">
                      Gemini 2.0 Flash will watch your video, identifying key actions, characters, and stylistic beats.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeVideo}
                      disabled={isAnalyzing}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center gap-3 transition-all w-full justify-center shadow-2xl"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      {isAnalyzing ? 'ANALYZING FOOTAGE...' : 'BEGIN ANALYSIS'}
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-12">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <Layers className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Extracted Scenes ({scenes.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenes.map((scene, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={i} 
                        className="bg-zinc-950/50 p-6 rounded-3xl border border-zinc-800/50 hover:border-cyan-500/30 transition-all duration-300 group"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em]">Scene {scene.sceneNumber || i + 1}</div>
                          <div className="h-1 w-6 bg-zinc-800 group-hover:w-10 group-hover:bg-cyan-500/50 transition-all duration-500" />
                        </div>
                        <div className="space-y-4">
                          <div className="relative group/box">
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px]">Action</label>
                              <button 
                                onClick={() => repromptScene(i)}
                                className="opacity-0 group-hover/box:opacity-100 p-1 hover:bg-white/5 rounded-lg transition-all text-cyan-500"
                                title="Improve with AI"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                            <textarea 
                              value={scene.action || ''}
                              onChange={(e) => {
                                const newScenes = [...scenes];
                                newScenes[i] = { ...scene, action: e.target.value };
                                setScenes(newScenes);
                              }}
                              placeholder="Describe the action..."
                              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50 resize-none h-20 transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] block mb-1.5">Characters</label>
                              <input 
                                type="text"
                                value={scene.characters || ''}
                                onChange={(e) => {
                                  const newScenes = [...scenes];
                                  newScenes[i] = { ...scene, characters: e.target.value };
                                  setScenes(newScenes);
                                }}
                                placeholder="Who's in the scene?"
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 transition-all"
                              />
                            </div>
                            <div className="relative group/mood">
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px]">Mood</label>
                                <button 
                                  onClick={() => repromptScene(i)}
                                  className="opacity-0 group-hover/mood:opacity-100 p-0.5 hover:bg-white/5 rounded transition-all text-cyan-500"
                                  title="Improve with AI"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <input 
                                type="text"
                                value={scene.mood || ''}
                                onChange={(e) => {
                                  const newScenes = [...scenes];
                                  newScenes[i] = { ...scene, mood: e.target.value };
                                  setScenes(newScenes);
                                }}
                                placeholder="Atmosphere..."
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-cyan-400/80 italic focus:outline-none focus:border-cyan-500/50 transition-all"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-zinc-500 font-black uppercase tracking-widest text-[9px] block mb-1.5">Setting</label>
                            <input 
                              type="text"
                              value={scene.setting || ''}
                              onChange={(e) => {
                                const newScenes = [...scenes];
                                newScenes[i] = { ...scene, setting: e.target.value };
                                setScenes(newScenes);
                              }}
                              placeholder="Environment..."
                              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="p-8 bg-zinc-950/50 rounded-[2rem] border border-zinc-800/50">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-cyan-500" />
                      <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Visual Style & Model</h3>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                        {['16:9', '9:16'].map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio as any)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                              aspectRatio === ratio ? 'bg-zinc-800 text-cyan-400 shadow-xl' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                      <select
                        value={veoModel}
                        onChange={(e) => setVeoModel(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none transition-all cursor-pointer"
                      >
                        <option value="veo-2.0-generate-001">Veo 2.0 (Stable)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-10">
                    {STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border ${
                          selectedStyle === style 
                            ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] scale-105' 
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {selectedStyle === 'Custom' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <input
                          type="text"
                          value={customStyle}
                          onChange={e => setCustomStyle(e.target.value)}
                          placeholder="Describe your custom style (e.g., 1980s VHS tape, Claymation...)"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-8 transition-all placeholder:text-zinc-600"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-end pt-4 relative z-50">
                    <button
                      onClick={(e) => {
                        console.log('GENERATE CLICKED');
                        e.preventDefault();
                        e.stopPropagation();
                        startGeneration();
                      }}
                      className="bg-cyan-500 hover:bg-cyan-400 active:scale-95 disabled:opacity-30 text-black font-black uppercase tracking-[0.2em] py-5 px-10 rounded-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-cyan-500/20 group cursor-pointer"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      )}
                      <span className="text-sm">{isGenerating ? 'SYNTHESIZING...' : 'IGNITE GENERATION'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Video className="w-5 h-5 text-zinc-500" />
                        <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Original</h3>
                      </div>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{aspectRatio} Format</span>
                    </div>
                    <div className="relative rounded-[2rem] overflow-hidden border border-zinc-800 shadow-2xl aspect-video bg-black group">
                      {originalVideoUrl ? (
                        <video src={originalVideoUrl} controls className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[10px] font-black uppercase tracking-widest">Original Unavailable</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-cyan-500" />
                        <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">Remake</h3>
                      </div>
                      {isAssembling && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-cyan-500 uppercase tracking-widest animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Assembling Master...
                        </div>
                      )}
                    </div>
                    <div className="relative rounded-[2rem] overflow-hidden border border-zinc-800 shadow-2xl aspect-video bg-zinc-900 flex items-center justify-center group">
                      {finalVideo ? (
                        <video src={finalVideo} controls autoPlay loop className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-10">
                          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 mx-auto border border-zinc-800 group-hover:border-cyan-500/30 transition-all duration-500">
                            {isAssembling || isGenerating ? (
                              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                            ) : (
                              <Play className="w-10 h-10 text-zinc-700" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                              {isAssembling ? 'Processing Final Export' : isGenerating ? 'Generating Scenes' : 'Waiting for Generations'}
                            </p>
                            {isGenerating && currentGeneratingScene !== -1 && (
                              <p className="text-[9px] font-black text-cyan-500/60 uppercase tracking-widest">
                                Scene {currentGeneratingScene + 1} / {scenes.length}
                              </p>
                            )}
                            {isAssembling && (
                              <div className="w-32 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden mt-4">
                                <motion.div 
                                  className="h-full bg-cyan-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${assemblyProgress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h4 className="text-2xl font-black text-white font-sans uppercase tracking-tight mb-2">Scene Variants</h4>
                      <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Select the best version for each scene to assemble the master.</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {remadeScenes.length > 0 && (
                        <button
                          onClick={reGenerateAll}
                          disabled={isGenerating || isAssembling}
                          className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-30"
                        >
                          <RotateCcw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          RE-GENERATE ALL
                        </button>
                      )}

                      <button
                        onClick={downloadAllClips}
                        className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        DOWNLOAD CLIPS
                      </button>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={!allScenesGenerated || isAssembling || isGenerating}
                        onClick={assembleFinalVideo}
                        className={`flex items-center gap-3 px-8 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl ${
                          allScenesGenerated && !isGenerating
                            ? 'bg-cyan-500 text-black hover:bg-cyan-400' 
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {isAssembling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Film className="w-5 h-5" />}
                        ASSEMBLE MASTER
                      </motion.button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-12">
                    {/* Compact Scene List */}
                    <div className="space-y-6">
                      {remadeScenes.map((remadeScene, i) => (
                        <div key={i} className="bg-zinc-950/40 border border-zinc-800/50 rounded-[2rem] p-6 flex flex-col md:flex-row gap-8 items-center group/scene relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/30 group-hover/scene:bg-cyan-500 transition-all" />
                          
                          {/* Left: Metadata */}
                          <div className="w-full md:w-48 shrink-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-zinc-900 text-cyan-400 text-[10px] font-black px-3 py-1 rounded-full border border-zinc-800">
                                SCENE {String(i + 1).padStart(2, '0')}
                              </span>
                              {remadeScene.status === 'done' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed italic">
                              "{scenes[i]?.action}"
                            </p>
                          </div>

                          {/* Middle: Reference Image (Mocked or From Extraction) */}
                          <div className="w-full md:w-64 shrink-0">
                            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 aspect-video bg-zinc-900 group/ref">
                               <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[9px] font-bold uppercase tracking-widest bg-zinc-900">
                                 Image Reference
                               </div>
                               <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                            </div>
                          </div>

                          {/* Right: Remade Video */}
                          <div className="flex-1 w-full relative">
                             <motion.div 
                                className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-500 aspect-video ${
                                  remadeScene.status === 'done' ? 'border-cyan-500/50 shadow-lg' : 'border-zinc-800 bg-zinc-950'
                                }`}
                              >
                                {remadeScene.loading ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
                                    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Synthesizing...</span>
                                    {remadeScene.startTime && <ElapsedTime startTime={remadeScene.startTime} />}
                                  </div>
                                ) : remadeScene.error ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center w-full">
                                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                                    <p className="text-[9px] text-red-400 line-clamp-2 mb-2 font-bold px-2">{remadeScene.error}</p>
                                    <div className="flex items-center justify-center gap-2 w-full">
                                      <button 
                                        onClick={() => retryVariant(i)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[9px] font-black uppercase transition-all"
                                      >
                                        <RefreshCw className="w-3 h-3" /> RETRY
                                      </button>
                                      {remadeScene.error.toLowerCase().includes('quota') && (
                                        <button 
                                          onClick={openKeySelection}
                                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[9px] font-black uppercase transition-all"
                                          title="Change API Key"
                                        >
                                          <Key className="w-3 h-3" /> KEY
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : remadeScene.url ? (
                                  <video 
                                    src={remadeScene.url} 
                                    className="w-full h-full object-cover" 
                                    autoPlay loop muted playsInline 
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                                    <div className="w-8 h-8 border-2 border-dashed border-zinc-800 rounded-lg mb-2" />
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Awaiting Sequence</span>
                                  </div>
                                )}

                                {/* Overlay Download */}
                                {remadeScene.url && (
                                  <div className="absolute bottom-3 right-3 opacity-0 group-hover/scene:opacity-100 transition-opacity">
                                    <a 
                                      href={remadeScene.url} 
                                      download={`scene_${i+1}.mp4`}
                                      className="p-2 bg-black/60 hover:bg-cyan-500 text-white hover:text-black rounded-lg backdrop-blur-md border border-white/10 transition-all"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </div>
                                )}
                             </motion.div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right: System Logs */}
                    <div className="lg:col-span-4">
                      <div className="sticky top-8 space-y-6">
                        <div className="flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                            <Terminal className="w-4 h-4 text-cyan-500" />
                            <h3 className="text-sm font-black text-white font-sans uppercase tracking-tight">System Logs</h3>
                          </div>
                          {(isGenerating || isAssembling) && (
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                              <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest">Live</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 h-[600px] overflow-y-auto font-mono text-[10px] space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                          <AnimatePresence mode="popLayout">
                            {logs.map((log, i) => (
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={i}
                                className={`flex gap-3 group py-1.5 border-b border-zinc-900/30 last:border-0 ${
                                  log.type === 'error' ? 'text-red-400' : 
                                  log.type === 'success' ? 'text-cyan-400' : 
                                  'text-zinc-400'
                                }`}
                              >
                                <span className="text-zinc-700 shrink-0 font-bold tracking-tighter">[{log.time}]</span>
                                <div className="flex-1">
                                  <span className="font-medium leading-relaxed">{log.message}</span>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          <div ref={logsEndRef} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Final Video Modal */}
      <AnimatePresence>
        {showFinalModal && finalVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/95 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-7xl bg-zinc-950 rounded-[3rem] overflow-hidden border border-zinc-800/50 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row h-full max-h-[90vh]"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowFinalModal(false)}
                className="absolute top-8 right-8 z-50 w-12 h-12 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/10 group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>

              {/* Video Preview Section */}
              <div className="lg:flex-1 bg-black flex items-center justify-center relative group overflow-hidden">
                <video 
                  src={finalVideo} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain" 
                />
                
                {/* Decorative Elements */}
                <div className="absolute top-10 left-10 pointer-events-none">
                  <div className="flex items-center gap-4 px-6 py-2 bg-cyan-500 text-black rounded-full font-black uppercase tracking-[0.3em] text-[10px] shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                    <Sparkles className="w-3 h-3" />
                    Master Export
                  </div>
                </div>
                
                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end pointer-events-none">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Project Name</p>
                    <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{projectName}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resolution</p>
                    <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{aspectRatio === '16:9' ? '1920x1080' : '1080x1920'}</p>
                  </div>
                </div>
              </div>

              {/* Info & Actions Section */}
              <div className="lg:w-[450px] p-12 flex flex-col justify-between border-l border-zinc-800/50 bg-zinc-950">
                <div className="space-y-12">
                  <header>
                    <h2 className="text-5xl font-black text-white font-sans uppercase tracking-tighter leading-[0.85] mb-6">
                      Style<br />
                      <span className="text-cyan-500">Remake</span><br />
                      Complete
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="h-1 w-20 bg-cyan-500 rounded-full" />
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Success</span>
                    </div>
                  </header>

                  <div className="space-y-8">
                    <div className="group">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 group-hover:text-cyan-500/50 transition-colors">Selected Style</p>
                      <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{selectedStyle === 'Custom' ? customStyle : selectedStyle}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Total Scenes</p>
                        <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{scenes.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Duration</p>
                        <p className="text-xl font-black text-white font-sans uppercase tracking-tight">~{scenes.length * 3}s</p>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-zinc-900">
                      <div className="flex items-center gap-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">
                        <FolderOpen className="w-3 h-3 text-cyan-500" />
                        <span>Saved to Local Storage</span>
                      </div>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                        The master file has been cached in your browser. Use the download button below to save it to your device.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-12">
                  <motion.a
                    whileHover={{ scale: 1.02, backgroundColor: '#22d3ee' }}
                    whileTap={{ scale: 0.98 }}
                    href={finalVideo}
                    download={`${projectName.toLowerCase().replace(/\s+/g, '-')}-remake.mp4`}
                    className="w-full bg-cyan-500 text-black py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(6,182,212,0.2)] transition-all"
                  >
                    <Download className="w-5 h-5" />
                    DOWNLOAD MASTER
                  </motion.a>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setShowFinalModal(false)}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all border border-zinc-800"
                    >
                      <Video className="w-4 h-4" />
                      VIEW VARIANTS
                    </button>
                    <button
                      onClick={() => reset()}
                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all border border-zinc-800"
                    >
                      <RefreshCw className="w-4 h-4" />
                      NEW PROJECT
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
