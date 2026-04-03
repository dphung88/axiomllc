import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Play, Image as ImageIcon, Video, FileText, Download, Terminal, FolderOpen, AlertCircle, Sparkles, ArrowRight, Zap, Maximize2, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { useQuickGen } from '../context/QuickGenContext';
import { fetchAndDownload } from '../utils/downloadHelper';

export function QuickGen() {
  const { customApiKey, directoryHandle, provider } = useSettings();
  const {
    isGenerating,
    resultUrl,
    error,
    logs,
    prompt,
    activeTab,
    aspectRatio,
    veoModel,
    image,
    lastFrame,
    setPrompt,
    setActiveTab,
    setAspectRatio,
    setVeoModel,
    setImage,
    setLastFrame,
    handleGenerate,
    resetGeneration,
  } = useQuickGen();

  const [hasApiKey, setHasApiKey] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const handleDownloadVideo = async () => {
    if (!resultUrl) return;
    try {
      await fetchAndDownload(resultUrl, `quickgen-${Date.now()}.mp4`, directoryHandle);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      if (customApiKey) {
        setHasApiKey(true);
        return;
      }
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, [customApiKey]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'lastFrame') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64Data = dataUrl.split(',')[1];
      const obj = { data: base64Data, mimeType: file.type, url: dataUrl };
      if (type === 'image') setImage(obj);
      else setLastFrame(obj);
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-12 max-w-[1600px] mx-auto min-h-screen"
    >

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] w-12 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Veo 3.1 Instant Engine</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
            Quick <span className="text-cyan-500">Gen</span>
          </h1>
          <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
            Instantly synthesize single video clips from text, images, or reference frames.
          </p>
        </div>
        <div className="pt-4">
          <button
            onClick={resetGeneration}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest flex items-center gap-3 transition-all border border-zinc-800 text-xs group"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /> 
            NEW GENERATION
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Settings Panel */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="flex border-b border-white/5 bg-black/20 overflow-x-auto hide-scrollbar">
              {[
                { id: 'text', label: 'Text', icon: FileText },
                { id: 'image', label: 'Image', icon: ImageIcon },
                { id: 'video', label: 'Video', icon: Video },
                { id: 'logs', label: 'Logs', icon: Terminal },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-5 px-6 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all relative ${
                      active ? 'text-cyan-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {active && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-8 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Zap className="w-32 h-32 text-cyan-500" />
              </div>

              <div className="space-y-6 relative z-10">
                {activeTab === 'logs' ? (
                  <div className="bg-black/40 border border-white/5 rounded-3xl p-6 h-[400px] flex flex-col shadow-xl backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-zinc-500">
                        <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Neural Process Output</span>
                      </div>
                    </div>
                    <div 
                      ref={logsContainerRef}
                      className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] hide-scrollbar bg-black/20 rounded-2xl p-4 border border-white/[0.02]"
                    >
                      {logs.length === 0 && (
                        <div className="text-zinc-700 italic">Awaiting neural initialization...</div>
                      )}
                      {logs.map((log, i) => (
                        <div key={i} className={`flex gap-3 leading-relaxed border-l-2 pl-3 ${
                          log.type === 'error' ? 'text-red-400 border-red-500/50' : 
                          log.type === 'success' ? 'text-cyan-400 border-cyan-500/50' : 
                          'text-zinc-500 border-zinc-800'
                        }`}>
                          <span className="opacity-30 shrink-0 font-bold">[{log.time}]</span>
                          <span className="break-words">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Model Engine</label>
                    <div className="relative">
                      <select 
                        value={veoModel}
                        onChange={(e) => setVeoModel(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all cursor-pointer"
                      >
                        {provider === 'bytedance' ? (
                          <>
                            <option value="seedance-1-5-pro" className="bg-zinc-900">Seedance 1.5 Pro (Audio + Video)</option>
                            <option value="seedance-1-0-pro-fast" className="bg-zinc-900">Seedance 1.0 Pro Fast</option>
                            <option value="seedance-1-0-pro" className="bg-zinc-900">Seedance 1.0 Pro</option>
                          </>
                        ) : (
                          <>
                            <option value="veo-3.1-fast-generate-preview" className="bg-zinc-900">Veo 3.1 - Fast</option>
                            <option value="veo-3.1-generate-preview" className="bg-zinc-900">Veo 3.1 - High Quality</option>
                            <option value="veo-2.0-generate-001" className="bg-zinc-900">Veo 2.0 (Stable)</option>
                          </>
                        )}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                        <ArrowRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Aspect Ratio</label>
                    <div className="flex bg-black/40 border border-white/5 rounded-2xl p-1">
                      <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          aspectRatio === '16:9' ? 'bg-cyan-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        16:9
                      </button>
                      <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          aspectRatio === '9:16' ? 'bg-cyan-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        9:16
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Creative Prompt</label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your vision in detail..."
                    className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-cyan-500 font-sans h-40 resize-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-zinc-700"
                  />
                </div>

                {(activeTab === 'image' || activeTab === 'video') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
                        {activeTab === 'video' ? 'Start Frame' : 'Reference Image'}
                      </label>
                      <div className={`relative ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] max-h-[300px]'} bg-black/40 border border-white/5 rounded-2xl overflow-hidden group cursor-pointer`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'image')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {image ? (
                          <img src={image.url} alt="Reference" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Upload Source</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {activeTab === 'video' && (
                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">End Frame</label>
                        <div className={`relative ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] max-h-[300px]'} bg-black/40 border border-white/5 rounded-2xl overflow-hidden group cursor-pointer`}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'lastFrame')}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          {lastFrame ? (
                            <img src={lastFrame.url} alt="End Frame" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                              <ImageIcon className="w-8 h-8" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Upload Target</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!prompt || isGenerating}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-cyan-500/20 group mt-4"
                >
                  {isGenerating ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="text-sm">{isGenerating ? 'SYNTHESIZING...' : 'IGNITE GENERATION'}</span>
                </button>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Result Display */}
        <div className="lg:col-span-7 space-y-8 flex flex-col">
          <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/5 rounded-[3rem] p-12 flex-1 flex flex-col items-center justify-center relative overflow-hidden shadow-inner group/canvas min-h-[500px]">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="text-center space-y-8 z-10"
                >
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" />
                    <div className="relative bg-zinc-800/50 backdrop-blur-md border border-white/10 rounded-full w-full h-full flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight font-sans">SYNTHESIZING</h3>
                    <p className="text-zinc-500 font-medium">Neural engine is processing your imagination...</p>
                  </div>
                </motion.div>
              ) : resultUrl ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full flex flex-col items-center gap-10"
                >
                  <div className="relative group max-w-full">
                    <div className="absolute -inset-4 bg-cyan-500/10 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <video 
                      src={resultUrl} 
                      controls 
                      autoPlay 
                      loop 
                      className={`rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 max-w-full max-h-[60vh] object-contain relative z-10 bg-black ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'}`}
                    />
                    
                    <div className="absolute top-6 right-6 flex gap-3 z-20">
                      <button 
                        onClick={() => setShowFullView(true)}
                        className="bg-black/60 backdrop-blur-md text-white p-3 rounded-xl hover:bg-cyan-500 hover:text-black transition-all"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleDownloadVideo}
                        className="bg-cyan-500 text-black p-3 rounded-xl hover:bg-cyan-400 transition-all shadow-xl shadow-cyan-500/20"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <button 
                      onClick={handleGenerate}
                      className="flex items-center gap-3 text-zinc-500 hover:text-cyan-500 transition-all text-xs font-black uppercase tracking-[0.3em] group"
                    >
                      <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                      REGENERATE
                    </button>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                        <span className="text-zinc-400">{aspectRatio}</span>
                        <span>•</span>
                        <span className="text-zinc-400">720p</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-8 max-w-md px-8"
                >
                  <div className="bg-red-500/10 p-6 rounded-3xl w-24 h-24 mx-auto flex items-center justify-center border border-red-500/20">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight font-sans">GENERATION FAILED</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{error}</p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-white/5"
                  >
                    TRY AGAIN
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  className="text-center space-y-8"
                >
                  <div className="relative">
                    <Video className="w-40 h-40 mx-auto text-zinc-800" />
                    <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-zinc-600 uppercase tracking-[0.2em] font-sans">Awaiting Input</h3>
                    <p className="text-zinc-700 font-bold uppercase tracking-widest text-xs">Your creation will appear here</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Background Decoration */}
            <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -top-48 -left-48 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
          </div>

        </div>
      </div>
      {/* Full View Modal */}
      <AnimatePresence>
        {showFullView && resultUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/95 backdrop-blur-2xl"
            onClick={() => setShowFullView(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex flex-col items-center gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowFullView(false)}
                className="absolute -top-16 right-0 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-10 h-10" />
              </button>
              
              <video 
                src={resultUrl} 
                controls 
                autoPlay 
                loop 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 bg-black"
              />
              
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDownloadVideo}
                  className="bg-cyan-500 text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-cyan-400 transition-all flex items-center gap-3 shadow-2xl shadow-cyan-500/40"
                >
                  <Download className="w-5 h-5" />
                  DOWNLOAD MASTER
                </button>
                <button 
                  onClick={() => setShowFullView(false)}
                  className="bg-zinc-800 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-zinc-700 transition-all border border-white/5"
                >
                  CLOSE PREVIEW
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
