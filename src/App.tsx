/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ApiKeyGate } from './components/ApiKeyGate';
import { StoryBuilder } from './pages/StoryBuilder';
import { StyleRemaker } from './pages/StyleRemaker';
import { QuickGen } from './pages/QuickGen';
import { AutoStoryGen } from './pages/AutoStoryGen';
import { ImageGen } from './pages/ImageGen';
import { Gallery } from './pages/Gallery';
import { Settings } from './pages/Settings';
import { Film, Wand2, Zap, Video, Sparkles, Image as ImageIcon, Settings as SettingsIcon, LayoutGrid } from 'lucide-react';
import { RemakerProvider, useRemaker } from './context/RemakerContext';
import { AutoStoryProvider, useAutoStory } from './context/AutoStoryContext';
import { StoryBuilderProvider, useStoryBuilder } from './context/StoryBuilderContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { QuickGenProvider, useQuickGen } from './context/QuickGenContext';
import { ImageGenProvider, useImageGen } from './context/ImageGenContext';

function Sidebar() {
  const location = useLocation();
  const { isGenerating, remadeScenes, scenes, showToast } = useRemaker();
  const { isGeneratingVideos, generationProgress } = useAutoStory();
  const { isGenerating: quickIsGenerating } = useQuickGen();
  const { isGenerating: imageIsGenerating } = useImageGen();
  const storyBuilderState = useStoryBuilder();
  const { provider } = useSettings();

  const completedScenes = remadeScenes.filter(s => s.url || s.error).length;
  const totalScenes = scenes.length;

  const sbCompleted = storyBuilderState.scenes.filter(s => s.status === 'done' || s.status === 'error').length;
  const sbTotal = storyBuilderState.scenes.length;
  const sbIsGenerating = storyBuilderState.isSequentialLoopRunning;

  const links = [
    { path: '/', label: 'Image Gen', icon: ImageIcon },
    { path: '/quick', label: 'Quick Gen', icon: Zap },
    { path: '/auto', label: 'Idea to Video', icon: Sparkles },
    { path: '/story', label: 'Story Builder', icon: Film },
    { path: '/remaker', label: 'Style Remaker', icon: Wand2 },
    { path: '/gallery', label: 'Gallery', icon: LayoutGrid },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (isGenerating && location.pathname === '/remaker' && path !== '/remaker') {
      showToast('Generation is background.');
    }
  };

  const providerLabel = provider === 'bytedance' ? 'Seedance · Seed 2.0' : 'Veo 3.1 · Gemini 2.5';
  const providerBadgeColor = provider === 'bytedance'
    ? 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    : 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20';

  return (
    <div className="w-64 bg-main-bg border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-cyan-500 p-2 rounded-xl">
          <Video className="w-6 h-6 text-black" />
        </div>
        <h1 className="font-black text-base text-white tracking-tighter leading-tight uppercase">
          AXIOM LLC<br/><span className="text-cyan-500">Studio</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {links.map(link => {
          const active = location.pathname === link.path;
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={(e) => handleNavClick(e, link.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-cyan-500/10 text-cyan-500 font-black uppercase tracking-wider text-xs'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-black uppercase tracking-wider text-xs'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-cyan-500' : 'text-zinc-400'}`} />
              {link.label}
              {link.path === '/' && imageIsGenerating && (
                <span className="ml-auto bg-cyan-500 text-black text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                  ...
                </span>
              )}
              {link.path === '/remaker' && isGenerating && totalScenes > 0 && (
                <span className="ml-auto bg-cyan-500 text-black text-[10px] px-2 py-0.5 rounded-full">
                  {completedScenes}/{totalScenes}
                </span>
              )}
              {link.path === '/auto' && isGeneratingVideos && generationProgress.total > 0 && (
                <span className="ml-auto bg-cyan-500 text-black text-[10px] px-2 py-0.5 rounded-full">
                  {generationProgress.current}/{generationProgress.total}
                </span>
              )}
              {link.path === '/quick' && quickIsGenerating && (
                <span className="ml-auto bg-cyan-500 text-black text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                  ...
                </span>
              )}
              {link.path === '/story' && sbIsGenerating && sbTotal > 0 && (
                <span className="ml-auto bg-cyan-500 text-black text-[10px] px-2 py-0.5 rounded-full">
                  {sbCompleted}/{sbTotal}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Version + provider badge */}
      <div className="px-6 py-4 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Version</span>
          <span className={`text-[9px] font-black border px-2 py-0.5 rounded-full tracking-widest ${providerBadgeColor}`}>
            v1.0.0
          </span>
        </div>
        <p className="text-[8px] text-zinc-700 mt-1 tracking-wide">Powered by {providerLabel}</p>
      </div>
    </div>
  );
}

function Toast() {
  const { toastMessage } = useRemaker();
  if (!toastMessage) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-zinc-800 text-white px-4 py-3 rounded-xl shadow-lg border border-zinc-700 z-50 animate-in slide-in-from-bottom-5">
      {toastMessage}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ApiKeyGate>
        <RemakerProvider>
          <AutoStoryProvider>
            <StoryBuilderProvider>
              <QuickGenProvider>
                <ImageGenProvider>
                  <BrowserRouter>
                    <div className="flex h-screen bg-main-bg text-white font-sans overflow-hidden">
                      <Sidebar />
                      <main className="flex-1 overflow-y-auto relative bg-main-bg">
                        <Routes>
                          <Route path="/" element={<ImageGen />} />
                          <Route path="/auto" element={<AutoStoryGen />} />
                          <Route path="/story" element={<StoryBuilder />} />
                          <Route path="/remaker" element={<StyleRemaker />} />
                          <Route path="/quick" element={<QuickGen />} />
                          <Route path="/gallery" element={<Gallery />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                        <Toast />
                      </main>
                    </div>
                  </BrowserRouter>
                </ImageGenProvider>
              </QuickGenProvider>
            </StoryBuilderProvider>
          </AutoStoryProvider>
        </RemakerProvider>
      </ApiKeyGate>
    </SettingsProvider>
  );
}
