import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, FolderOpen, Database, Layout, Monitor, CheckCircle2, Key, AlertCircle, Loader2, Cpu, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { GoogleGenAI } from '@google/genai';
import { checkStorageBucket } from '../services/supabase';

export function Settings() {
  const {
    projectName, setProjectName,
    storagePath, setStoragePath,
    defaultModel, setDefaultModel,
    llmModel, setLlmModel,
    defaultAspectRatio, setDefaultAspectRatio,
    customApiKey, setCustomApiKey,
    useVertexAI, setUseVertexAI,
    directoryHandle, setDirectoryHandle,
    resetSettings
  } = useSettings();

  const [saved, setSaved] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [checkingBucket, setCheckingBucket] = useState(false);
  const [bucketResult, setBucketResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testApiKey = async () => {
    if (!customApiKey) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }

    setTestingKey(true);
    setTestResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: customApiKey });
      const response = await ai.models.generateContent({
        model: llmModel || 'gemini-2.5-flash',
        contents: 'Hello, are you working?',
      });

      if (response.text) {
        setTestResult({ success: true, message: 'API Key is valid and working!' });
      } else {
        setTestResult({ success: false, message: 'API returned an empty response.' });
      }
    } catch (error: any) {
      console.error('API Key test failed:', error);
      let errorMessage = error.message || 'Unknown error occurred.';
      if (errorMessage.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid API Key. Please check and try again.';
      }
      setTestResult({ success: false, message: errorMessage });
    } finally {
      setTestingKey(false);
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
            Configure your global project defaults and storage preferences.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                          // Check if we are in an iframe
                          const isInIframe = window.self !== window.top;
                          
                          if (isInIframe) {
                            if (confirm("Browser security prevents folder selection inside this preview window. You need to open the app in a new tab to use this feature. Open now?")) {
                              window.open(window.location.href, '_blank');
                            }
                            return;
                          }

                          // @ts-ignore
                          if (typeof window.showDirectoryPicker === 'function') {
                            // @ts-ignore
                            const handle = await window.showDirectoryPicker({
                              mode: 'readwrite'
                            });
                            setDirectoryHandle(handle);
                            setStoragePath(handle.name);
                          } else {
                            alert("Your browser doesn't support direct folder selection. Please type the path manually.");
                          }
                        } catch (err: any) {
                          console.error('Folder selection error:', err);
                          if (err.name === 'SecurityError' || (err.message && (err.message.includes('sub frames') || err.message.includes('cross-origin')))) {
                            if (confirm("Browser security prevents folder selection here. Would you like to open the app in a new tab to use this feature?")) {
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
                            if (permission === 'granted') {
                              alert("Permission granted! The app can now save files to this folder.");
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors"
                      >
                        Re-verify Access
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-white mb-2">
                <Layout className="w-5 h-5 text-cyan-500" />
                <h3 className="text-xl font-bold uppercase tracking-tight">Global Defaults</h3>
              </div>

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
                    { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', desc: 'Stable Legacy' }
                  ].map(model => (
                    <button
                      key={model.id}
                      onClick={() => setLlmModel(model.id)}
                      className={`flex-1 min-w-[140px] p-4 rounded-xl border text-left transition-all ${
                        (llmModel || 'gemini-2.0-flash') === model.id 
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold text-xs uppercase tracking-widest mb-1">{model.name}</div>
                      <div className="text-[10px] opacity-60 italic">{model.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-zinc-500 italic flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Gemini 1.5 models are deprecated. Use 2.0+ for compatibility.
                </p>
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

              <div className="pt-6 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-white mb-6">
                  <Key className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-xl font-bold uppercase tracking-tight">API Configuration</h3>
                </div>

                {/* Vertex AI toggle */}
                <div className={`mb-6 rounded-2xl border p-5 transition-all ${useVertexAI ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${useVertexAI ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                        <Cpu className={`w-5 h-5 ${useVertexAI ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm uppercase tracking-wider mb-1">
                          Use GCP Credits for Video (Vertex AI)
                        </p>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                          Route Veo video generation through Vertex AI → charges go to your Google Cloud project → <strong className="text-zinc-300">uses $300 free trial credit</strong> instead of direct billing.
                        </p>
                        {useVertexAI && (
                          <p className="mt-2 text-emerald-400 text-xs font-semibold">
                            ✓ Active — Veo calls will use your GCP free credits
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      onClick={() => setUseVertexAI(!useVertexAI)}
                      className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${useVertexAI ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useVertexAI ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {useVertexAI && (
                    <div className="mt-4 pt-4 border-t border-emerald-500/20">
                      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">One-time Setup Required:</p>
                      <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside leading-relaxed">
                        <li>Create a <strong className="text-white">Google Cloud service account</strong> with role: <code className="text-emerald-400">Vertex AI User</code></li>
                        <li>Download the <strong className="text-white">JSON key</strong> file</li>
                        <li>In <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">Supabase Dashboard</a> → Edge Functions → Secrets → add: <code className="text-emerald-400 break-all">GOOGLE_SA_JSON = (paste JSON content)</code></li>
                        <li>Enable <strong className="text-white">Vertex AI API</strong> on your GCP project</li>
                      </ol>
                      <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-cyan-400 text-xs font-semibold hover:text-cyan-300 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open GCP Service Accounts
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Custom Gemini API Key</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input 
                          type="password" 
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          placeholder="Enter your Gemini API Key"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-cyan-500 font-sans focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                        />
                      </div>
                      <button
                        onClick={testApiKey}
                        disabled={testingKey || !customApiKey}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-zinc-700 flex items-center gap-2"
                      >
                        {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Test Key
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                      testResult.success 
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                      <p className="text-sm font-medium">{testResult.message}</p>
                    </div>
                  )}
                </div>
              </div>
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

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex items-start gap-4 shadow-xl">
          <div className="bg-cyan-500/10 p-3 rounded-xl">
            <Monitor className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h4 className="text-white font-bold uppercase tracking-tight mb-1">Local Persistence</h4>
            <p className="text-zinc-500 text-sm">Your settings are saved locally in your browser. They will persist across sessions but are specific to this device and browser.</p>
          </div>
        </div>

        {/* Supabase Storage Health Check */}
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
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
              bucketResult.ok
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              {bucketResult.ok
                ? <><CheckCircle2 className="w-5 h-5 shrink-0" /><span>Bucket "studio-media" is accessible. Video uploads should work.</span></>
                : <><AlertCircle className="w-5 h-5 shrink-0" /><div><p className="font-bold">Bucket error: {bucketResult.error}</p><p className="text-xs mt-1 opacity-80">Go to Supabase Dashboard → Storage → Create bucket "studio-media" → set Public → add INSERT policy for anon role.</p></div></>
              }
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
