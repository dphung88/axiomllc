import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getSupabaseEdgeUrl } from '../services/apiConfig';
import { useSettings } from '../context/SettingsContext';
import { fetchAndDownload } from '../utils/downloadHelper';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Video, Download, Trash2, RefreshCw, AlertTriangle, Loader2, Flame } from 'lucide-react';

interface GalleryItem {
  id: string;
  created_at: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  settings: any;
}

const STORAGE_BUCKET = 'studio-media';

// Extract storage path from a Supabase public URL
// e.g. https://xxx.supabase.co/storage/v1/object/public/studio-media/videos/abc.mp4 → videos/abc.mp4
const extractStoragePath = (url: string): string | null => {
  try {
    const marker = `/object/public/${STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return null;
  }
};

const isValidStorageUrl = (url: string) =>
  url.startsWith('data:') ||
  (url.startsWith('https://') && url.includes('/storage/'));

export function Gallery() {
  const { directoryHandle } = useSettings();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteAllState, setDeleteAllState] = useState<'idle' | 'confirm' | 'running'>('idle');
  const [deleteAllProgress, setDeleteAllProgress] = useState('');

  const handleDownload = async (item: GalleryItem) => {
    if (!isValidStorageUrl(item.url)) {
      alert('This file has an expired temporary URL and cannot be downloaded.');
      return;
    }
    setDownloadingId(item.id);
    try {
      const ext = item.type === 'video' ? 'mp4' : 'jpg';
      const filename = `studio-${item.type}-${Date.now()}.${ext}`;
      if (item.url.startsWith('data:')) {
        const res = await fetch(item.url);
        const blob = await res.blob();
        const { downloadFile } = await import('../utils/downloadHelper');
        await downloadFile(blob, filename, directoryHandle);
      } else {
        await fetchAndDownload(item.url, filename, directoryHandle);
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('studio_gallery')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  // Supabase anon key for Edge Function Authorization header
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || '';
  const edgeFetchHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  };

  // Delete one item — storage path via Edge Function, DB via client
  const handleDelete = async (item: GalleryItem) => {
    if (!window.confirm('Delete this item from archives?')) return;
    setDeletingId(item.id);
    try {
      // 1. Delete storage file via Edge Function (has service role key)
      const storagePath = extractStoragePath(item.url);
      if (storagePath) {
        const edgeUrl = getSupabaseEdgeUrl();
        await fetch(`${edgeUrl}/storage-purge`, {
          method: 'POST',
          headers: edgeFetchHeaders,
          body: JSON.stringify({ paths: [storagePath] }),
        }).catch(e => console.warn('Storage delete via edge failed:', e));
      }
      // 2. Remove from DB
      const { error } = await supabase.from('studio_gallery').delete().eq('id', item.id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`Failed to delete: ${error.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Delete ALL items via Edge Function (uses service role key — bypasses Storage RLS)
  const handleDeleteAll = async () => {
    setDeleteAllState('running');
    setDeleteAllProgress('Connecting to server...');
    try {
      const edgeUrl = getSupabaseEdgeUrl();
      setDeleteAllProgress('Deleting all files from Storage + database...');

      const res = await fetch(`${edgeUrl}/storage-purge`, {
        method: 'POST',
        headers: edgeFetchHeaders,
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        const errMsg = result.errors?.join(', ') || result.error || 'Unknown error';
        throw new Error(errMsg);
      }

      setItems([]);
      setDeleteAllState('idle');
      setDeleteAllProgress('');
    } catch (err: any) {
      console.error('Delete all failed:', err);
      alert(`Delete all failed: ${err.message || 'Unknown error'}`);
      setDeleteAllState('idle');
      setDeleteAllProgress('');
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  return (
    <div className="p-12 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-[2px] w-12 bg-cyan-500"></div>
            <span className="text-cyan-500 font-black tracking-[0.3em] text-[10px] uppercase">Archives</span>
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase font-sans">
            Studio <span className="text-cyan-500">Gallery</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Storage info */}
          <div className="hidden md:block px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Database</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] text-zinc-300 font-mono">
                {import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'Unknown'}
              </span>
            </div>
          </div>

          <button
            onClick={fetchGallery}
            className="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all text-zinc-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Delete All button */}
          {items.length > 0 && deleteAllState === 'idle' && (
            <button
              onClick={() => setDeleteAllState('confirm')}
              className="flex items-center gap-2 px-4 py-3 bg-zinc-900 hover:bg-red-500/20 border border-zinc-800 hover:border-red-500/50 rounded-xl transition-all text-zinc-500 hover:text-red-400 font-black text-xs uppercase tracking-wider"
              title="Delete all items + free Supabase storage"
            >
              <Flame className="w-4 h-4" />
              Clear All
            </button>
          )}
          {deleteAllState === 'running' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
              <span className="text-[10px]">{deleteAllProgress || 'Working...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete All dialog */}
      <AnimatePresence>
        {deleteAllState === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-8 p-5 bg-red-500/10 border border-red-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <p className="text-red-400 font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Delete ALL {items.length} items?
              </p>
              <p className="text-zinc-500 text-xs">
                This will permanently delete all gallery records <strong className="text-zinc-400">and</strong> free all files from Supabase Storage (videos + audio). Cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleDeleteAll}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              >
                Yes, Delete All
              </button>
              <button
                onClick={() => setDeleteAllState('idle')}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 bg-zinc-950/30 rounded-[3rem] border border-dashed border-zinc-800">
          <p className="text-zinc-500 font-black uppercase tracking-widest">Your gallery is empty.</p>
          <p className="text-zinc-600 text-xs mt-2 uppercase tracking-widest">Generations will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {items.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={item.id}
              className="group relative bg-zinc-900/50 rounded-3xl border border-zinc-800/50 overflow-hidden flex flex-col"
            >
              <div className="aspect-square relative overflow-hidden bg-black flex items-center justify-center">
                {!isValidStorageUrl(item.url) ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-zinc-600 p-6">
                    <AlertTriangle className="w-8 h-8 text-zinc-700" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Expired<br/>Temporary URL</span>
                  </div>
                ) : item.type === 'image' ? (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover opacity-80" muted loop
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                )}

                <div className="absolute top-4 right-4">
                  {item.type === 'image'
                    ? <ImageIcon className="w-5 h-5 text-white drop-shadow-lg" />
                    : <Video className="w-5 h-5 text-white drop-shadow-lg" />}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleDownload(item)}
                    disabled={downloadingId === item.id || !isValidStorageUrl(item.url)}
                    className="p-3 bg-cyan-500 text-black rounded-full hover:bg-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Download"
                  >
                    {downloadingId === item.id
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Download className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="p-3 bg-zinc-800 text-white rounded-full hover:bg-red-500 transition-all disabled:opacity-40"
                    title="Delete from archives + storage"
                  >
                    {deletingId === item.id
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <p className="text-[11px] text-zinc-400 line-clamp-3 mb-4 font-medium italic">"{item.prompt}"</p>
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest">
                    {item.settings?.model?.split('-')[0] || 'Gen AI'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
