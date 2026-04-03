import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Image as ImageIcon, Video, Play, CheckCircle2, Loader2, Download, Film, AlertCircle, Terminal, FolderOpen, RefreshCw, X, Sparkles, Key, UserCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { useStoryBuilder } from '../context/StoryBuilderContext';
import { fetchAndDownload } from '../utils/downloadHelper';
import { AspectRatio } from '../types';
import { GenerationStatus } from '../components/GenerationStatus';

export function StoryBuilder() {
  const { projectName, directoryHandle, provider } = useSettings();
  const {
    scenes,
    isAssembling,
    assemblyProgress,
    assemblyError,
    finalVideo,
    aspectRatio,
    veoModel,
    logs,
    isSequentialLoopRunning,
    characterRefImage,
    setAspectRatio,
    setVeoModel,
    addScene,
    removeScene,
    updateScenePrompt,
    handleImageUpload,
    setCharacterRefImage,
    generateSceneVideo,
    assembleVideo,
    reset,
    addLog
  } = useStoryBuilder();

  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [viewMode, setViewMode] = useState<'master' | 'clips'>('master');

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (finalVideo) {
      setShowFinalModal(true);
    }
  }, [finalVideo]);

  const downloadAllClips = async () => {
    addLog('Downloading all clips...', 'info');
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.url) {
        await fetchAndDownload(scene.url, `story_scene_${String(i + 1).padStart(2, '0')}.mp4`, directoryHandle).catch(console.error);
      }
    }
    addLog('Clips downloaded successfully.', 'success');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the story builder? All scenes will be lost.')) {
      reset();
    }
  };

  const allScenesGenerated = scenes.length > 0 && scenes.every(s => s.status === 'done');
  
  const totalPrompts = scenes.length;
  const donePrompts = scenes.filter(s => s.status === 'done').length;
  const errorPrompts = scenes.filter(s => s.status === 'error').length;
  const sentPrompts = scenes.filter(s => s.status === 'processing' || s.status === 'done' || s.status === 'error').length;
  const progressPercent = totalPrompts > 0 ? ((donePrompts + errorPrompts) / totalPrompts) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-12 max-w-[1600px] mx-auto"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] w-12 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Scene By Scene</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
            Story <span className="text-cyan-500">Builder</span>
          </h1>
          <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
            Create your video scene by scene with precise control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4">
          <button
            onClick={handleReset}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all border border-zinc-800 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            RESET
          </button>

          <div className="flex bg-zinc-950 rounded-xl p-1.5 border border-zinc-800">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                aspectRatio === '16:9' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              16:9
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                aspectRatio === '9:16' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              9:16
            </button>
          </div>

          <div className="relative">
            <select
              value={veoModel}
              onChange={(e) => setVeoModel(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-10 py-4 text-xs font-black text-cyan-500 font-sans focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none transition-all uppercase tracking-wider"
            >
              {provider === 'bytedance' ? (
                <>
                  <option value="seedance-1-5-pro">Seedance 1.5 Pro</option>
                  <option value="seedance-1-0-pro-fast">Seedance 1.0 Fast</option>
                  <option value="seedance-1-0-pro">Seedance 1.0 Pro</option>
                </>
              ) : (
                <>
                  <option value="veo-3.1-fast-generate-preview">Veo 3.1 - Fast</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 - High Quality</option>
                  <option value="veo-2.0-generate-001">Veo 2.0 (Stable)</option>
                </>
              )}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500"></div>
            </div>
          </div>

          <button
            onClick={assembleVideo}
            disabled={!allScenesGenerated || isAssembling}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-cyan-500/20 text-xs"
          >
            {isAssembling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Film className="w-5 h-5" />}
            ASSEMBLE FINAL VIDEO
          </button>
        </div>
      </div>

      {(isSequentialLoopRunning || isAssembling) && (
        <GenerationStatus 
          total={totalPrompts}
          sent={sentPrompts}
          done={donePrompts}
          error={errorPrompts}
          progress={isAssembling ? assemblyProgress : progressPercent}
        />
      )}

      {assemblyError && (
        <div className="mb-8 bg-red-950/20 border border-red-900/50 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="font-medium text-red-400 mb-2 font-sans">ASSEMBLY FAILED</p>
          <p className="text-sm text-zinc-400 mb-4">{assemblyError}</p>
        </div>
      )}

      {/* Character Lock */}
      <div className="mb-8 p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl flex items-center gap-6">
        <div className="shrink-0">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.25em] mb-1 flex items-center gap-2">
            <UserCircle2 className="w-3 h-3 text-cyan-500" /> Character Lock
          </p>
          <p className="text-[10px] text-zinc-600 max-w-[260px]">
            Upload a character reference image — applied to all scenes for visual consistency.
          </p>
        </div>
        <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-zinc-700 hover:border-cyan-500/50 transition-all bg-zinc-950 cursor-pointer group">
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                setCharacterRefImage({ data: dataUrl.split(',')[1], mimeType: file.type, url: dataUrl });
              };
              reader.readAsDataURL(file);
            }}
          />
          {characterRefImage ? (
            <img src={characterRefImage.url} className="w-full h-full object-cover" alt="Character ref" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-1 text-zinc-600 group-hover:text-zinc-400 transition-colors">
              <UserCircle2 className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">Upload</span>
            </div>
          )}
        </div>
        {characterRefImage && (
          <button
            onClick={() => setCharacterRefImage(null)}
            className="text-[9px] font-black text-zinc-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        )}
      </div>

      <div className="space-y-8">
        {scenes.map((scene, index) => (
          <div key={scene.id} className="bg-zinc-950/40 border border-zinc-800/50 rounded-[2rem] p-6 flex flex-col lg:flex-row gap-8 items-stretch group/scene relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/30 group-hover/scene:bg-cyan-500 transition-all" />
            
            {/* Left: Input Controls */}
            <div className="flex-1 flex flex-col min-w-[300px] h-full space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-zinc-900 text-cyan-400 text-[10px] font-black px-3 py-1 rounded-full border border-zinc-800">
                  SCENE {String(index + 1).padStart(2, '0')}
                </span>
                <button onClick={() => removeScene(scene.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Prompt</label>
                <textarea
                  value={scene.prompt}
                  onChange={(e) => updateScenePrompt(scene.id, e.target.value)}
                  placeholder="Describe the scene in detail..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-cyan-500 h-28 resize-none focus:outline-none focus:border-cyan-500/50 transition-all text-sm leading-relaxed font-sans"
                />
              </div>

              <div className="flex gap-4 flex-1">
                <div className="relative border border-dashed border-zinc-800 hover:border-cyan-500/50 rounded-2xl p-4 text-center cursor-pointer overflow-hidden group bg-zinc-950/30 flex-1 flex flex-col justify-center min-h-[100px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(scene.id, e)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {scene.image ? (
                    <img src={scene.image.url} alt="Reference" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                  ) : (
                    <div className="relative z-0 flex flex-col items-center gap-2">
                      <ImageIcon className="w-6 h-6 text-zinc-500" />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Image Ref</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => generateSceneVideo(scene.id)}
                  disabled={!scene.prompt || scene.loading}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 rounded-2xl font-black uppercase tracking-widest flex flex-col items-center justify-center gap-2 transition-all flex-1 min-h-[100px]"
                >
                  {scene.loading ? <Loader2 className="w-6 h-6 animate-spin text-cyan-500" /> : <Play className="w-6 h-6" />}
                  <span className="text-[10px]">GENERATE</span>
                </button>
              </div>
            </div>

            {/* Right: Video Output */}
            <div className="w-full lg:w-[450px] xl:w-[600px] shrink-0 flex flex-col justify-center">
              <div className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-500 w-full ${
                aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] max-w-[300px] mx-auto'
              } ${scene.status === 'done' ? 'border-cyan-500/50 shadow-lg' : 'border-zinc-800 bg-zinc-950'}`}>
                {scene.loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
                    <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Synthesizing...</span>
                  </div>
                ) : scene.error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center w-full">
                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                    <p className="text-[9px] text-red-400 line-clamp-2 mb-2 font-bold px-2">{scene.error}</p>
                    <div className="flex items-center justify-center gap-2 w-full">
                      <button 
                        onClick={() => generateSceneVideo(scene.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[9px] font-black uppercase transition-all"
                      >
                        <RefreshCw className="w-3 h-3" /> RETRY
                      </button>
                      {scene.error.toLowerCase().includes('quota') && (
                        <button 
                          onClick={() => {
                            if (window.aistudio?.openSelectKey) window.aistudio.openSelectKey();
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[9px] font-black uppercase transition-all"
                          title="Change API Key"
                        >
                          <Key className="w-3 h-3" /> KEY
                        </button>
                      )}
                    </div>
                  </div>
                ) : scene.url ? (
                  <>
                    <video src={scene.url} className="w-full h-full object-cover" autoPlay loop muted playsInline controls />
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover/scene:opacity-100 transition-opacity">
                      <button
                        onClick={() => fetchAndDownload(scene.url!, `scene_${index+1}.mp4`, directoryHandle).catch(console.error)}
                        className="p-2 bg-black/60 hover:bg-cyan-500 text-white hover:text-black rounded-lg backdrop-blur-md border border-white/10 transition-all block"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                    <div className="w-10 h-10 border-2 border-dashed border-zinc-800 rounded-xl mb-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Awaiting Output</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addScene}
          className="w-full py-6 border-2 border-dashed border-zinc-800 hover:border-cyan-500/50 rounded-[2rem] flex items-center justify-center gap-3 text-zinc-500 hover:text-cyan-400 transition-colors font-black uppercase tracking-widest text-sm bg-zinc-950/20 hover:bg-zinc-900/50"
        >
          <Plus className="w-5 h-5" />
          ADD NEW SCENE
        </button>
      </div>

      {/* System Logs */}
      {(logs.length > 0 || isAssembling) && (
        <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl p-8">
          <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
            <Terminal className="w-4 h-4 text-cyan-400" /> System Logs
          </h3>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[11px] hide-scrollbar">
            {logs.length === 0 ? (
              <div className="text-zinc-600 text-center py-10">Waiting for operations...</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                    <span className={`${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-cyan-400' : 
                      'text-zinc-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

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
                <AnimatePresence mode="wait">
                  {viewMode === 'master' ? (
                    <motion.div
                      key="master-view"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full"
                    >
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
                    </motion.div>
                  ) : (
                    <motion.div
                      key="clips-view"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="w-full h-full p-12 overflow-y-auto hide-scrollbar bg-zinc-950"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
                        {scenes.filter(s => s.url).map((scene, idx) => (
                          <div key={scene.id} className="group/clip relative">
                            <div className={`relative rounded-2xl overflow-hidden border border-zinc-800 bg-black ${
                              aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'
                            }`}>
                              <video src={scene.url} className="w-full h-full object-cover" controls />
                              <div className="absolute top-4 left-4">
                                <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
                                  CLIP {String(idx + 1).padStart(2, '0')}
                                </span>
                              </div>
                              <div className="absolute bottom-4 right-4 opacity-0 group-hover/clip:opacity-100 transition-opacity">
                                <button
                                  onClick={() => fetchAndDownload(scene.url!, `scene_${idx+1}.mp4`, directoryHandle).catch(console.error)}
                                  className="p-3 bg-cyan-500 text-black rounded-xl shadow-xl transition-all hover:scale-110 block"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate px-2">
                              {scene.prompt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Info & Actions Section */}
              <div className="lg:w-[450px] p-12 flex flex-col justify-between border-l border-zinc-800/50 bg-zinc-950">
                <div className="space-y-12">
                  <header>
                    <h2 className="text-5xl font-black text-white font-sans uppercase tracking-tighter leading-[0.85] mb-6">
                      Story<br />
                      <span className="text-cyan-500">Builder</span><br />
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
                      <p className="text-xl font-black text-white font-sans uppercase tracking-tight">{scenes.length}</p>
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
                    download={`${projectName.toLowerCase().replace(/\s+/g, '-')}-story.mp4`}
                    className="w-full bg-cyan-500 text-black py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(6,182,212,0.2)] transition-all"
                  >
                    <Download className="w-5 h-5" />
                    DOWNLOAD MASTER
                  </motion.a>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {viewMode === 'master' ? (
                      <button
                        onClick={() => setViewMode('clips')}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all border border-zinc-800"
                      >
                        <Video className="w-4 h-4" />
                        VIEW CLIPS
                      </button>
                    ) : (
                      <button
                        onClick={() => setViewMode('master')}
                        className="bg-zinc-900 hover:bg-zinc-800 text-cyan-500 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                      >
                        <Film className="w-4 h-4" />
                        BACK TO MASTER
                      </button>
                    )}
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
