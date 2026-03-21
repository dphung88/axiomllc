import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Play, Users, Image as ImageIcon, Video, FileText, CheckCircle2, Film, Download, AlertCircle, ArrowUpCircle, Upload, Type, Volume2, Wand2, RotateCcw, Plus, Terminal, FolderOpen, Key, RefreshCw, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAutoStory } from '../context/AutoStoryContext';
import { useSettings } from '../context/SettingsContext';
import { GenerationStatus } from '../components/GenerationStatus';
import { AspectRatio } from '../types';

const STYLES = [
  '3D Pixar', 'Anime', 'Realistic', 'Cartoon', 'Cyberpunk', 'Watercolor'
];

export function AutoStoryGen() {
  const { customApiKey, storagePath } = useSettings();
  const {
    inputType, setInputType,
    idea, setIdea,
    style, setStyle,
    sceneCount, setSceneCount,
    language, setLanguage,
    aspectRatio, setAspectRatio,
    veoModel, setVeoModel,
    activeTab, setActiveTab,
    isGeneratingScript,
    scriptData,
    scenesState,
    isGeneratingVideos,
    generationProgress,
    finalVideo,
    isAssembling,
    assemblyProgress,
    assemblyError,
    workflowError,
    hasApiKey,
    showSubtitles,
    setShowSubtitles,
    generateWorkflow,
    retryVariant,
    upscaleVariant,
    assembleVideo,
    reset,
    openKeySelection,
    openDirectoryPicker
  } = useAutoStory();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('MY VIDEO WORKFLOW');
  const [downloadQuality, setDownloadQuality] = useState('720p');
  const [logs, setLogs] = useState<{time: string, message: string, type: 'info' | 'success' | 'error'}[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [showFinalModal, setShowFinalModal] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  useEffect(() => {
    if (isGeneratingScript) addLog("Started generating script...", "info");
    if (scriptData) addLog("Script generated successfully.", "success");
    if (workflowError) addLog(`Workflow error: ${workflowError}`, "error");
  }, [isGeneratingScript, scriptData, workflowError]);

  useEffect(() => {
    if (isGeneratingVideos && generationProgress.total > 0) {
      addLog(`Generating videos (${generationProgress.current}/${generationProgress.total})...`, "info");
    }
  }, [isGeneratingVideos, generationProgress.current, generationProgress.total]);

  useEffect(() => {
    if (isAssembling) addLog(`Merging videos... ${assemblyProgress}%`, "info");
    if (assemblyError) addLog(`Assembly error: ${assemblyError}`, "error");
    if (finalVideo) {
      addLog("Final video assembled successfully.", "success");
      setShowFinalModal(true);
    }
  }, [isAssembling, assemblyProgress, assemblyError, finalVideo]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleGenerateClick = () => {
    setLogs([]);
    addLog(`Initializing workflow: ${workflowName}`, "info");
    generateWorkflow(videoFile || undefined);
  };

  const downloadAllClips = () => {
    addLog("Downloading all generated clips...", "info");
    scenesState.forEach((scene, i) => {
      const videoUrl = scene.url;
      if (videoUrl) {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `edison-yang-studio_scene_${String(i + 1).padStart(2, '0')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
    addLog("Clips downloaded successfully.", "success");
  };

  const allVideosDone = scenesState.length > 0 && scenesState.every(s => !s.loading);
  const hasSuccessfulVideos = scenesState.some(s => s.url);

  const totalPrompts = scriptData ? scriptData.scenes.length : 0;
  const donePrompts = scenesState.filter(s => s.status === 'done').length;
  const errorPrompts = scenesState.filter(s => s.status === 'error').length;
  const sentPrompts = scenesState.filter(s => s.status === 'processing' || s.status === 'done' || s.status === 'error').length;
  const progressPercent = totalPrompts > 0 ? ((donePrompts + errorPrompts) / totalPrompts) * 100 : 0;

  const statusTabs = [
    { id: 'script', label: 'SCRIPT', icon: FileText },
    { id: 'prompts', label: 'PROMPTS', icon: Type },
    { id: 'videos', label: 'VIDEOS', icon: Video },
    { id: 'logs', label: 'LOGS', icon: Terminal },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-12 max-w-[1600px] mx-auto bg-main-bg min-h-screen"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] w-12 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Idea to Video</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
            Auto <span className="text-cyan-500">Story</span>
          </h1>
          <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
            Automatically generate a complete video from a simple text idea.
          </p>
        </div>
        <div className="pt-4">
          <button
            onClick={() => {
              reset();
              setVideoFile(null);
              setVideoPreviewUrl(null);
              setLogs([]);
            }}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all border border-zinc-800 text-xs group"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-[-180deg] transition-transform duration-500" /> 
            NEW WORKFLOW
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Settings */}
        <div className="lg:col-span-1 space-y-6">
          {scriptData && (
            <div className="space-y-4">
              <GenerationStatus 
                total={totalPrompts}
                sent={sentPrompts}
                done={donePrompts}
                error={errorPrompts}
                progress={progressPercent}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tabs={statusTabs}
              />
            </div>
          )}
          <div className="bg-secondary-bg border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6">CREATE NEW WORKFLOW</h2>
            
            <div className="space-y-5">
              {/* Row 1: Workflow Name & Prompt Type */}
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">WORKFLOW NAME</label>
                  <input 
                    type="text" 
                    value={workflowName} 
                    onChange={(e) => setWorkflowName(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">STORAGE PATH</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={storagePath} 
                      onChange={(e) => {
                        // We need to access setStoragePath from settings context via useAutoStory if available
                        // But for now, let's keep it read-only unless we modify the context
                      }}
                      readOnly
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-400 font-mono text-[10px] outline-none" 
                    />
                    <button 
                      onClick={openDirectoryPicker}
                      className="bg-zinc-800 hover:bg-zinc-700 text-cyan-500 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-zinc-700 transition-all flex items-center gap-2"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      BROWSE
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Prompt Type</label>
                  <select 
                    value={inputType} 
                    onChange={(e) => setInputType(e.target.value as any)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="text">Ideas by Text</option>
                    <option value="video">Ideas by Video</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Model */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Model (Veo)</label>
                  <select 
                    value={veoModel}
                    onChange={(e) => setVeoModel(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="veo-3.1-fast-generate-preview">Veo 3.1 Fast (Preview)</option>
                    <option value="veo-3-generate-preview">Veo 3.0 (Preview)</option>
                    <option value="veo-2.0-generate-001">Veo 2.0 (Stable)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Visual Style & Dialogue */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Visual Style</label>
                  <select 
                    value={style} 
                    onChange={(e) => setStyle(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Dialogue Language</label>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value as any)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="en">English (en-US)</option>
                    <option value="vi">Vietnamese (vi-VN)</option>
                    <option value="none">No Voiceover</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Download Quality & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Download Quality</label>
                  <select 
                    value={downloadQuality} 
                    onChange={(e) => setDownloadQuality(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Aspect Ratio</label>
                  <select 
                    value={aspectRatio} 
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="16:9">Landscape (16:9)</option>
                    <option value="9:16">Portrait (9:16)</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Scenes & Subtitles */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Scenes</label>
                  <select 
                    value={sceneCount} 
                    onChange={(e) => setSceneCount(parseInt(e.target.value))} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => <option key={n} value={n}>{n} Scene{n>1?'s':''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1 whitespace-nowrap">Auto Subtitles</label>
                  <div 
                    onClick={() => setShowSubtitles(!showSubtitles)}
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all hover:bg-zinc-900 ${showSubtitles ? 'ring-1 ring-cyan-500/50' : ''}`}
                  >
                    <span className="text-sm text-white font-sans">{showSubtitles ? 'On' : 'Off'}</span>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${showSubtitles ? 'bg-cyan-500' : 'bg-zinc-700'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showSubtitles ? 'left-6' : 'left-1'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="pt-2">
                {inputType === 'text' ? (
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-2">Your Idea</label>
                    <textarea
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="e.g., A cat family goes on a cruise trip, encounters a storm, and washes up on a deserted island..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-cyan-500 font-sans h-32 resize-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-2">Source Video</label>
                    {videoPreviewUrl ? (
                      <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video max-h-48 mx-auto">
                        <video src={videoPreviewUrl} controls className="w-full h-full object-contain" />
                        <button 
                          onClick={() => { setVideoFile(null); setVideoPreviewUrl(null); }}
                          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg backdrop-blur-md transition-colors text-sm font-medium"
                        >
                          Change Video
                        </button>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-zinc-800 hover:border-cyan-500 rounded-xl p-8 text-center transition-colors bg-zinc-950">
                        <input 
                          type="file" 
                          accept="video/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setVideoFile(file);
                              setVideoPreviewUrl(URL.createObjectURL(file));
                            }
                          }} 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                        <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                        <p className="text-sm text-zinc-300 font-medium">Click or drag video to upload</p>
                        <p className="text-xs text-zinc-500 mt-1">MP4, WebM, MOV</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateClick}
                disabled={(inputType === 'text' && !idea) || (inputType === 'video' && !videoFile) || isGeneratingScript || isGeneratingVideos}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-4 py-3 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors mt-6"
              >
                {isGeneratingScript || isGeneratingVideos ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {isGeneratingScript ? 'WRITING SCRIPT...' : isGeneratingVideos ? 'GENERATING VIDEOS...' : 'START WORKFLOW'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2">
          <div className="bg-secondary-bg border border-zinc-800 rounded-2xl overflow-hidden shadow-xl h-full flex flex-col min-h-[600px]">
            <div className="flex border-b border-zinc-800 bg-secondary-bg/50">
              {[
                { id: 'script', label: 'SCRIPT', icon: Users },
                { id: 'prompts', label: 'PROMPTS', icon: FileText },
                { id: 'videos', label: 'VIDEOS', icon: Video },
                { id: 'logs', label: 'LOGS', icon: Terminal },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-4 px-2 flex items-center justify-center gap-2 font-bold uppercase tracking-wider transition-colors text-[10px] border-b-2 ${
                      active 
                        ? 'bg-zinc-800/50 text-cyan-400 border-cyan-500' 
                        : 'text-zinc-500 border-transparent hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-zinc-950/50">
              {workflowError && (
                <div className="mb-6 bg-red-950/20 border border-red-900/50 rounded-xl p-4 text-center text-sm text-red-400">
                  <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                  {workflowError}
                </div>
              )}

              {!scriptData && !isGeneratingScript && !workflowError && (
                <div className="h-full flex flex-col items-start justify-start pt-12 text-zinc-500">
                  <Wand2 className="w-12 h-12 mb-4 opacity-20" />
                  <h3 className="text-xl font-bold text-zinc-400 mb-2">Awaiting Input</h3>
                  <p className="text-sm">Enter an idea or upload a video to start the neural workflow.</p>
                </div>
              )}

              {isGeneratingScript && (
                <div className="h-full flex flex-col items-start justify-start pt-12 text-cyan-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" />
                  <h3 className="text-xl font-bold text-cyan-400 mb-2 uppercase tracking-widest font-sans">Neural Scripting</h3>
                  <p className="text-zinc-400 text-sm">Gemini is analyzing your idea and writing the production script...</p>
                </div>
              )}

              {scriptData && activeTab === 'script' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-white">Neural Storyboard</h3>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" /> Characters
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {scriptData.characters.map((char, i) => (
                          <div key={i} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                            <span className="font-bold text-cyan-300 block mb-1">{char.name}</span>
                            <span className="text-sm text-zinc-400">{char.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-cyan-400" /> Settings
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {scriptData.settings.map((setting, i) => (
                          <div key={i} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                            <span className="font-bold text-cyan-300 block mb-1">{setting.name}</span>
                            <span className="text-sm text-zinc-400">{setting.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {scriptData && activeTab === 'prompts' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-white">Production Prompts</h3>
                  </div>
                  <div className="space-y-4">
                    {scriptData.scenes.map((scene, i) => (
                      <div key={i} className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="bg-cyan-500 text-black text-xs font-bold px-2 py-1 rounded">SCENE {scene.sceneNumber}</span>
                          <span className="text-zinc-200 font-medium">{scene.action}</span>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                          <p className="text-sm text-zinc-400 font-mono leading-relaxed mb-2"><span className="text-cyan-400 font-bold">Prompt:</span> {scene.prompt}</p>
                          {scene.narration && (
                            <p className="text-sm text-zinc-300 leading-relaxed border-t border-zinc-800 pt-2 mt-2">
                              <span className="text-cyan-400 font-bold flex items-center gap-1"><Volume2 className="w-3 h-3" /> Voiceover:</span> {scene.narration}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(scriptData || isGeneratingVideos || scenesState.length > 0) && activeTab === 'videos' && (
                <div className="animate-in fade-in duration-300 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">Production Review</h3>
                    <div className="flex gap-3">
                      {scenesState.some(s => s.url) && (
                        <button
                          onClick={assembleVideo}
                          disabled={isAssembling}
                          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
                        >
                          {isAssembling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3" />}
                          {isAssembling ? `ASSEMBLING ${assemblyProgress}%` : 'ASSEMBLE MOVIE'}
                        </button>
                      )}
                    </div>
                  </div>

                  {finalVideo && (
                    <div className="bg-zinc-900 border-2 border-cyan-500/50 rounded-2xl overflow-hidden mb-8 shadow-2xl">
                      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-cyan-500/5">
                        <span className="text-cyan-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" /> Final Assembled Video
                        </span>
                        <a 
                          href={finalVideo} 
                          download="assembled_movie.mp4"
                          className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="aspect-video bg-black">
                        <video src={finalVideo} controls className="w-full h-full" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6">
                    {scenesState.map((scene, sceneIndex) => (
                      <div key={sceneIndex} className="bg-zinc-900/50 border border-zinc-800 rounded-[1.5rem] overflow-hidden flex flex-col md:flex-row items-stretch group/scene">
                        {/* Left: Metadata & Narration */}
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-zinc-950 text-cyan-400 text-[9px] font-black px-3 py-1 rounded-full border border-zinc-800">
                              SCENE {String(sceneIndex + 1).padStart(2, '0')}
                            </span>
                            {scene.status === 'done' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                          </div>
                          
                          {scriptData && (
                            <div className="flex-1 space-y-3">
                              <p className="text-[11px] text-zinc-300 leading-relaxed">
                                {scriptData.scenes[sceneIndex].action}
                              </p>
                              
                              {scriptData.scenes[sceneIndex].narration && (
                                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                                  <p className="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest mb-1">Narration</p>
                                  <p className="text-[10px] text-zinc-400 italic">"{scriptData.scenes[sceneIndex].narration}"</p>
                                  {scene.audioUrl && (
                                    <audio src={scene.audioUrl} controls className="w-full h-6 mt-2 opacity-50 hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: Video */}
                        <div className="w-full md:w-80 shrink-0 border-l border-zinc-800">
                          <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden h-full">
                            {scene.url ? (
                              <video 
                                src={scene.url} 
                                className="w-full h-full object-cover"
                                controls
                              />
                            ) : scene.loading ? (
                              <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                                <span className="text-[9px] font-black text-cyan-500/50 uppercase tracking-[0.2em]">Synthesizing...</span>
                              </div>
                            ) : scene.error ? (
                              <div className="p-4 text-center w-full">
                                <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                                <p className="text-[9px] text-red-400 line-clamp-2 mb-2 font-bold px-2">{scene.error}</p>
                                <div className="flex items-center justify-center gap-2 w-full">
                                  <button
                                    onClick={() => retryVariant(sceneIndex)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/30 hover:bg-red-500/50 active:bg-red-500/70 text-red-300 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer select-none"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                                  </button>
                                  {scene.error.toLowerCase().includes('quota') && (
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
                            ) : (
                              <div className="text-zinc-800 flex flex-col items-center gap-2">
                                <Video className="w-8 h-8 opacity-20" />
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-20">Queued</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="animate-in fade-in duration-300 h-full flex flex-col">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                      <div className="flex items-center gap-3 text-zinc-500">
                        <Terminal className="w-4 h-4 text-cyan-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Neural Process Output</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-cyan-500/50" />
                      </div>
                    </div>
                    <div 
                      ref={logsContainerRef}
                      className="flex-1 p-4 font-mono text-[10px] overflow-y-auto space-y-1.5 hide-scrollbar bg-black/20 max-h-[500px]"
                    >
                      {logs.length === 0 ? (
                        <div className="text-zinc-700">Awaiting system initialization...</div>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="flex gap-2 leading-tight">
                            <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                            <span className={`${
                              log.type === 'error' ? 'text-red-400' : 
                              log.type === 'success' ? 'text-cyan-400' : 
                              'text-zinc-400'
                            }`}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
                    <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{workflowName}</p>
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
                      Auto<br />
                      <span className="text-cyan-500">Story</span><br />
                      Complete
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="h-1 w-20 bg-cyan-500 rounded-full" />
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Success</span>
                    </div>
                  </header>

                  <div className="space-y-8">
                    <div className="group">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 group-hover:text-cyan-500/50 transition-colors">Total Scenes</p>
                      <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{scriptData?.scenes.length || 0}</p>
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
                    download={`${workflowName.toLowerCase().replace(/\s+/g, '-')}-story.mp4`}
                    className="w-full bg-cyan-500 text-black py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(6,182,212,0.2)] transition-all"
                  >
                    <Download className="w-5 h-5" />
                    DOWNLOAD MASTER
                  </motion.a>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => setShowFinalModal(false)}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all border border-zinc-800"
                    >
                      <Video className="w-4 h-4" />
                      VIEW CLIPS
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

