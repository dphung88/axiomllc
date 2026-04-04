import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, FolderOpen, Database, Layout, Monitor, CheckCircle2, Key, AlertCircle, Loader2, Cpu, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { useSettings } from '../context/SettingsContext';
import { checkStorageBucket } from '../services/supabase';

export function Settings() {
  const {
    provider, setProvider,
    projectName, setProjectName,
    storagePath, setStoragePath,
    defaultAspectRatio, setDefaultAspectRatio,
    directoryHandle, setDirectoryHandle,
    resetSettings,
    // Google
    customApiKey, setCustomApiKey,
    defaultModel, setDefaultModel,
    llmModel, setLlmModel,
    useVertexAI, setUseVertexAI,
    googleEnabled, setGoogleEnabled,
    // ByteDance
    arkApiKey, setArkApiKey,
    arkDefaultModel, setArkDefaultModel,
    arkLlmModel, setArkLlmModel,
    arkVideoEndpoint, setArkVideoEndpoint,
    bytedanceEnabled, setBytedanceEnabled,
  } = useSettings();

  const [saved, setSaved] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingArk, setTestingArk] = useState(false);
  const [arkTestResult, setArkTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [checkingBucket, setCheckingBucket] = useState(false);
  const [bucketResult, setBucketResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testGoogleKey = async () => {
    if (!customApiKey) {
      setGoogleTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }
    setTestingGoogle(true);
    setGoogleTestResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: customApiKey });
      const response = await ai.models.generateContent({
        model: llmModel || 'gemini-2.5-flash',
        contents: 'Hello, are you working?',
      });
      if (response.text) {
        setGoogleTestResult({ success: true, message: 'Google API Key is valid and working!' });
      } else {
        setGoogleTestResult({ success: false, message: 'API returned an empty response.' });
      }
    } catch (error: any) {
      let errorMessage = error.message || 'Unknown error occurred.';
      if (errorMessage.includes('API_KEY_INVALID')) errorMessage = 'Invalid API Key. Please check and try again.';
      setGoogleTestResult({ success: false, message: errorMessage });
    } finally {
      setTestingGoogle(false);
    }
  };

  const testArkKey = async () => {
    if (!arkApiKey) {
      setArkTestResult({ success: false, message: 'Please enter an ARK API key to test.' });
      return;
    }
    setTestingArk(true);
    setArkTestResult(null);
    try {
      const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${arkApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'seed-2-0-lite-260228',
          messages: [{ role: 'user', content: 'Hello, are you working?' }],
        }),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        setArkTestResult({ success: true, message: 'BytePlus ARK API Key is valid and working!' });
      } else {
        setArkTestResult({ success: false, message: `Unexpected response: ${JSON.stringify(data)}` });
      }
    } catch (err: any) {
      setArkTestResult({ success: false, message: err.message || 'Connection failed.' });
    } finally {
      setTestingArk(false);
    }
  };

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
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Configuration</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.85] mb-8 whitespace-nowrap font-sans">
            Studio <span className="text-cyan-500">Settings</span>
          </h1>
          <p className="text-zinc-500 text-xl max-w-2xl font-medium leading-relaxed">
            Configure your AI provider, API keys, and studio defaults.
          </p>
        </div>
      </div>

      <div className="space-y-8">

        {/* ── Provider Selector ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 text-white mb-6">
            <Cpu className="w-5 h-5 text-cyan-500" />
            <h3 className="text-xl font-bold uppercase tracking-tight">AI Provider</h3>
          </div>
          <p className="text-zinc-500 text-sm mb-6">Choose which AI backend to use for video generation and script writing. You can configure both and switch anytime.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google */}
            <div className={`p-6 rounded-2xl border text-left transition-all relative ${
              !googleEnabled
                ? 'bg-zinc-950 border-zinc-800 opacity-60'
                : provider === 'google'
                  ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.12)]'
                  : 'bg-zinc-950 border-zinc-800'
            }`}>
              {/* Enable/Disable toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setGoogleEnabled(!googleEnabled); }}
                className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  googleEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${googleEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {googleEnabled ? 'Enabled' : 'Disabled'}
              </button>
              {/* Card body — click to set active provider */}
              <button onClick={() => setProvider('google')} className="w-full text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${provider === 'google' && googleEnabled ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
                    <img src="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png" alt="Google" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-black text-sm uppercase tracking-wider ${provider === 'google' && googleEnabled ? 'text-blue-400' : 'text-zinc-400'}`}>Google</p>
                    {!googleEnabled
                      ? <p className="text-[10px] text-red-400/70 font-bold uppercase tracking-widest">Disabled</p>
                      : provider === 'google' && <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-widest">Active</p>
                    }
                  </div>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">Veo 3.1 video generation · Gemini 2.5 LLM · Vertex AI support</p>
              </button>
            </div>

            {/* ByteDance */}
            <div className={`p-6 rounded-2xl border text-left transition-all relative ${
              !bytedanceEnabled
                ? 'bg-zinc-950 border-zinc-800 opacity-60'
                : provider === 'bytedance'
                  ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.12)]'
                  : 'bg-zinc-950 border-zinc-800'
            }`}>
              {/* Enable/Disable toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setBytedanceEnabled(!bytedanceEnabled); }}
                className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  bytedanceEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${bytedanceEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {bytedanceEnabled ? 'Enabled' : 'Disabled'}
              </button>
              {/* Card body — click to set active provider */}
              <button onClick={() => setProvider('bytedance')} className="w-full text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${provider === 'bytedance' && bytedanceEnabled ? 'bg-orange-500/20' : 'bg-zinc-800'}`}>
                    <span className={`text-base font-black ${provider === 'bytedance' && bytedanceEnabled ? 'text-orange-400' : 'text-zinc-400'}`}>火</span>
                  </div>
                  <div>
                    <p className={`font-black text-sm uppercase tracking-wider ${provider === 'bytedance' && bytedanceEnabled ? 'text-orange-400' : 'text-zinc-400'}`}>ByteDance</p>
                    {!bytedanceEnabled
                      ? <p className="text-[10px] text-red-400/70 font-bold uppercase tracking-widest">Disabled</p>
                      : provider === 'bytedance' && <p className="text-[10px] text-orange-400/70 font-bold uppercase tracking-widest">Active</p>
                    }
                  </div>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">Seedance 1.5 Pro video generation · Seed 2.0 LLM · Native audio</p>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Config ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Left: Project Identity */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-white mb-2">
                <Database className="w-5 h-5 text-cyan-500" />
                <h3 className="text-xl font-bold uppercase tracking-tight">Project Identity</h3>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. My Studio Project"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Default Storage Path</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input
                        type="text"
                        value={storagePath}
                        onChange={(e) => setStoragePath(e.target.value)}
                        placeholder="/downloads/studio"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const isInIframe = window.self !== window.top;
                          if (isInIframe) {
                            if (confirm("Browser security prevents folder selection inside this preview window. Open in new tab?")) {
                              window.open(window.location.href, '_blank');
                            }
                            return;
                          }
                          // @ts-ignore
                          if (typeof window.showDirectoryPicker === 'function') {
                            // @ts-ignore
                            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                            setDirectoryHandle(handle);
                            setStoragePath(handle.name);
                          } else {
                            alert("Your browser doesn't support direct folder selection. Please type the path manually.");
                          }
                        } catch (err: any) {
                          if (err.name === 'SecurityError' || (err.message && (err.message.includes('sub frames') || err.message.includes('cross-origin')))) {
                            if (confirm("Browser security prevents folder selection here. Open in new tab?")) {
                              window.open(window.location.href, '_blank');
                            }
                          } else if (err.name !== 'AbortError') {
                            alert("Folder selection failed: " + (err.message || "Unknown error"));
                          }
                        }
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-zinc-700 flex items-center gap-2 whitespace-nowrap"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Browse
                    </button>
                  </div>
                  {directoryHandle && (
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">Connected Folder</p>
                          <p className="text-sm text-zinc-400">{directoryHandle.name}</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            // @ts-ignore
                            const permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
                            if (permission === 'granted') alert("Permission granted!");
                          } catch (err) { console.error(err); }
                        }}
                        className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors"
                      >
                        Re-verify Access
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Default Aspect Ratio</label>
                <select
                  value={defaultAspectRatio}
                  onChange={(e) => setDefaultAspectRatio(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none transition-all"
                >
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>
            </div>

            {/* Right: Provider-specific model/key settings */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-white mb-2">
                <Layout className="w-5 h-5 text-cyan-500" />
                <h3 className="text-xl font-bold uppercase tracking-tight">Global Defaults</h3>
              </div>

              {provider === 'google' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Default Video Model</label>
                    <select
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none transition-all"
                    >
                      <option value="veo-2.0-generate-001">Veo 2.0 (Stable)</option>
                      <option value="veo-3.1-fast-generate-preview">Veo 3.1 - Fast (Experimental)</option>
                      <option value="veo-3.1-generate-preview">Veo 3.1 - High Quality (Experimental)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Intelligence Model (LLM)</label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast & Smart' },
                        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Highest Intelligence' },
                        { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', desc: 'Stable Legacy' },
                      ].map(model => (
                        <button
                          key={model.id}
                          onClick={() => setLlmModel(model.id)}
                          className={`flex-1 min-w-[140px] p-4 rounded-xl border text-left transition-all ${
                            (llmModel || 'gemini-2.5-flash') === model.id
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-bold text-xs uppercase tracking-widest mb-1">{model.name}</div>
                          <div className="text-[10px] opacity-60 italic">{model.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Default Video Model</label>
                    <select
                      value={arkDefaultModel}
                      onChange={(e) => setArkDefaultModel(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none transition-all"
                    >
                      <option value="seedance-1-5-pro">Seedance 1.5 Pro (Audio + Video)</option>
                      <option value="seedance-1-0-pro-fast">Seedance 1.0 Pro Fast</option>
                      <option value="seedance-1-0-pro">Seedance 1.0 Pro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Intelligence Model (LLM)</label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'seed-2-0-lite-260228', name: 'Seed 2.0 Lite', desc: 'Fast & Smart' },
                        { id: 'seed-2-0-pro-260328', name: 'Seed 2.0 Pro', desc: 'Highest Intelligence' },
                      ].map(model => (
                        <button
                          key={model.id}
                          onClick={() => setArkLlmModel(model.id)}
                          className={`flex-1 min-w-[140px] p-4 rounded-xl border text-left transition-all ${
                            (arkLlmModel || 'seed-2-0-lite-260228') === model.id
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-bold text-xs uppercase tracking-widest mb-1">{model.name}</div>
                          <div className="text-[10px] opacity-60 italic">{model.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row gap-4 justify-between items-center">
            <button
              onClick={resetSettings}
              className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors text-sm font-bold uppercase tracking-widest"
            >
              <RefreshCw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              className="bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase tracking-widest px-10 py-4 rounded-xl flex items-center gap-3 transition-all shadow-lg shadow-cyan-500/20"
            >
              {saved ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
              {saved ? 'Settings Saved' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* ── Google API Credentials ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold uppercase tracking-tight">Google Cloud Credentials</h3>
              <p className="text-zinc-500 text-xs">Gemini API key + optional Vertex AI for GCP credits</p>
            </div>
            {provider === 'google' && (
              <span className="ml-auto text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
            )}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="AIza... (Google Gemini API Key)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={testGoogleKey}
              disabled={testingGoogle || !customApiKey}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-zinc-700 flex items-center gap-2"
            >
              {testingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test
            </button>
          </div>

          {googleTestResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${googleTestResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
              {googleTestResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{googleTestResult.message}</p>
            </div>
          )}

          {/* Vertex AI toggle */}
          <div className={`rounded-2xl border p-5 transition-all ${useVertexAI ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${useVertexAI ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                  <Cpu className={`w-5 h-5 ${useVertexAI ? 'text-emerald-400' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm uppercase tracking-wider mb-1">Use GCP Credits (Vertex AI)</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Route Veo video generation through Vertex AI → uses your <strong className="text-zinc-300">$300 free trial credit</strong> instead of direct billing.
                  </p>
                  {useVertexAI && <p className="mt-2 text-emerald-400 text-xs font-semibold">✓ Active — Veo calls will use your GCP free credits</p>}
                </div>
              </div>
              <button
                onClick={() => setUseVertexAI(!useVertexAI)}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${useVertexAI ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useVertexAI ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <p className="text-[10px] text-zinc-600">
            Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
              aistudio.google.com/apikey
            </a>
          </p>
        </div>

        {/* ── ByteDance ARK Credentials ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-orange-500/10">
              <Key className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold uppercase tracking-tight">BytePlus ModelArk Credentials</h3>
              <p className="text-zinc-500 text-xs">ARK API key for Seedance video + Seed 2.0 LLM</p>
            </div>
            {provider === 'bytedance' && (
              <span className="ml-auto text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
            )}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                value={arkApiKey}
                onChange={(e) => setArkApiKey(e.target.value)}
                placeholder="BytePlus ARK API Key"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={testArkKey}
              disabled={testingArk || !arkApiKey}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-zinc-700 flex items-center gap-2"
            >
              {testingArk ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test
            </button>
          </div>

          {arkTestResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${arkTestResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
              {arkTestResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{arkTestResult.message}</p>
            </div>
          )}

          {/* Seedance Video Endpoint ID */}
          <div className="border-t border-zinc-800 pt-6 space-y-3">
            <div>
              <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Seedance Video Endpoint ID
              </label>
              <p className="text-zinc-600 text-xs mb-3">
                BytePlus requires a custom inference endpoint for video generation.{' '}
                <a
                  href="https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 underline hover:text-orange-300"
                >
                  Console → Online Inference → Create Endpoint
                </a>
                {' '}→ copy the <strong className="text-zinc-400">ep-xxxx</strong> ID here.
              </p>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  value={arkVideoEndpoint}
                  onChange={(e) => setArkVideoEndpoint(e.target.value)}
                  placeholder="ep-2025xxxxxxxxxxxxxxxxx"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-orange-400 font-mono text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
              {arkVideoEndpoint && (
                <p className="text-[10px] text-emerald-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Custom endpoint active — will override default model selection
                </p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-zinc-600">
            Get your key at{' '}
            <a href="https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">
              BytePlus ModelArk Console → API Keys
            </a>
          </p>
        </div>

        {/* Storage health */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-3 rounded-xl">
                <Database className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <h4 className="text-white font-bold uppercase tracking-tight">Storage Bucket</h4>
                <p className="text-zinc-500 text-xs mt-0.5">Verify Supabase Storage is ready for video/image uploads</p>
              </div>
            </div>
            <button
              onClick={async () => {
                setCheckingBucket(true);
                setBucketResult(null);
                const result = await checkStorageBucket();
                setBucketResult(result);
                setCheckingBucket(false);
              }}
              disabled={checkingBucket}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-zinc-700 flex items-center gap-2 disabled:opacity-50"
            >
              {checkingBucket ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Check
            </button>
          </div>
          {bucketResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${bucketResult.ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
              {bucketResult.ok
                ? <><CheckCircle2 className="w-5 h-5 shrink-0" /><span>Bucket "studio-media" is accessible.</span></>
                : <><AlertCircle className="w-5 h-5 shrink-0" /><div><p className="font-bold">Bucket error: {bucketResult.error}</p><p className="text-xs mt-1 opacity-80">Go to Supabase Dashboard → Storage → Create bucket "studio-media" → set Public → add INSERT policy for anon role.</p></div></>
              }
            </div>
          )}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex items-start gap-4 shadow-xl">
          <div className="bg-cyan-500/10 p-3 rounded-xl">
            <Monitor className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h4 className="text-white font-bold uppercase tracking-tight mb-1">Local Persistence</h4>
            <p className="text-zinc-500 text-sm">Your settings are saved locally in your browser. They persist across sessions but are specific to this device and browser.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
