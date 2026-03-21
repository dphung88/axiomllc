import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, Download, Loader2, RefreshCw, Terminal, FolderOpen, AlertCircle, ArrowRight, Maximize2, Zap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { useImageGen } from '../context/ImageGenContext';

const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"];
const IMAGE_SIZES = ["512px", "1K", "2K", "4K"];
const MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Banana Pro (3.0)' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Banana Pro 2 (3.1)' },
  { id: 'gemini-2.5-flash-image', name: 'Banana Flash' }
];

export function ImageGen() {
  const { projectName, customApiKey } = useSettings();
  const {
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    imageSize, setImageSize,
    model, setModel,
    isGenerating, resultUrl,
    error, logs,
    handleGenerate, reset
  } = useImageGen();

  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'logs'>('generate');
  const [showFullView, setShowFullView] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

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

  const openKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    // Use Supabase Storage ?download= param — forces download on all browsers including Safari
    const a = document.createElement('a');
    a.href = `${url}?download=${filename}`;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-12 max-w-[1600px] mx-auto min-h-screen bg-main-bg"
    >

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[2px] w-12 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Banana Pro Engine v3.1</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
            Image <span className="text-cyan-500">Gen</span>
          </h1>
          <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
            Transform your imagination into high-fidelity visuals using state-of-the-art neural generation.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-secondary-bg backdrop-blur-xl border border-white/5 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="flex border-b border-white/5 bg-black/20">
              <button
                onClick={() => setActiveTab('generate')}
                className={`flex-1 py-5 px-8 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all relative ${
                  activeTab === 'generate' ? 'text-cyan-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Generate
                {activeTab === 'generate' && (
                  <motion.div layoutId="imageGenTab" className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-5 px-8 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all relative ${
                  activeTab === 'logs' ? 'text-cyan-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Logs
                {activeTab === 'logs' && (
                  <motion.div layoutId="imageGenTab" className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500" />
                )}
              </button>
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
                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Model Engine</label>
                      <div className="relative">
                        <select 
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all cursor-pointer"
                        >
                          {MODELS.map(m => <option key={m.id} value={m.id} className="bg-zinc-900">{m.name}</option>)}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                          <ArrowRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Visual Prompt</label>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your vision in detail..."
                        className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-cyan-500 font-sans h-48 resize-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder:text-zinc-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Aspect Ratio</label>
                        <div className="relative">
                          <select 
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all cursor-pointer"
                          >
                            {ASPECT_RATIOS.map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 ml-1">Resolution</label>
                        <div className="relative">
                          <select 
                            value={imageSize}
                            onChange={(e) => setImageSize(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-cyan-500 font-sans focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all cursor-pointer"
                          >
                            {IMAGE_SIZES.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt}
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
        <div className="lg:col-span-8 space-y-8 flex flex-col">
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
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight font-sans">CRAFTING VISUALS</h3>
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
                    <img 
                      src={resultUrl} 
                      alt="Generated" 
                      className="rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 max-w-full max-h-[70vh] object-contain relative z-10"
                    />
                    
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-6 rounded-3xl z-20 backdrop-blur-sm">
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowFullView(true)}
                          className="bg-white text-black px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-cyan-400 transition-all flex items-center gap-2"
                        >
                          <Maximize2 className="w-4 h-4" />
                          FULL VIEW
                        </button>
                        <button
                          onClick={() => downloadImage(resultUrl!, `banana-pro-${Date.now()}.png`)}
                          className="bg-cyan-500 text-black px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-cyan-400 transition-all flex items-center gap-2 shadow-xl shadow-cyan-500/20"
                        >
                          <Download className="w-4 h-4" />
                          DOWNLOAD
                        </button>
                      </div>
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
                        <span className="text-zinc-400">{imageSize}</span>
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
                    <ImageIcon className="w-40 h-40 mx-auto text-zinc-800" />
                    <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-zinc-600 uppercase tracking-[0.2em] font-sans">Awaiting Prompt</h3>
                    <p className="text-zinc-700 font-bold uppercase tracking-widest text-xs">Your masterpiece will appear here</p>
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
              
              <img 
                src={resultUrl} 
                alt="Full View" 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => downloadImage(resultUrl!, `banana-pro-${Date.now()}.png`)}
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
