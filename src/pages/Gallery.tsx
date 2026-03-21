import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { motion } from 'motion/react';
import { Image as ImageIcon, Video, Download, Trash2, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

interface GalleryItem {
  id: string;
  created_at: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  settings: any;
}

// Check if URL is a permanent Supabase Storage URL (not a dead blob/temp URL)
const isValidStorageUrl = (url: string) =>
  url.startsWith('https://') && url.includes('/storage/');

export function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadFile = async (item: GalleryItem) => {
    if (!isValidStorageUrl(item.url)) {
      alert('This file has an expired temporary URL and cannot be downloaded. Please regenerate it.');
      return;
    }
    setDownloadingId(item.id);
    try {
      // Fetch the file as blob (required for cross-origin download with filename)
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const ext = item.type === 'video'
        ? (blob.type.includes('mp4') ? 'mp4' : 'webm')
        : (blob.type.includes('png') ? 'png' : 'jpg');
      const filename = `studio-${item.type}-${Date.now()}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // Delay revoke so Safari has time to process before blob is freed
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 30000);
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item from archives?')) return;
    
    try {
      console.log(`Requesting deletion of item ID: ${id}`);
      const { error, count } = await supabase
        .from('studio_gallery')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        console.error('Supabase DELETE error:', error);
        throw error;
      }
      
      console.log(`Deleted count: ${count}`);
      if (count === 0) {
        console.warn('Deletion successful in request but 0 rows affected. Check RLS policies.');
        alert('Item was not deleted. This is likely a permission (RLS) issue in Supabase.');
      } else {
        setItems(items.filter(item => item.id !== id));
      }
    } catch (error: any) {
      console.error('CRITICAL: Delete failed:', error.message || error);
      alert(`Failed to delete item: ${error.message || 'Unknown error'}`);
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
        <div className="flex items-center gap-4">
          <div className="hidden md:block px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Database Status</span>
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
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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
              key={item.id}
              className="group relative bg-zinc-900/50 rounded-3xl border border-zinc-800/50 overflow-hidden flex flex-col"
            >
              <div className="aspect-square relative overflow-hidden bg-black flex items-center justify-center">
                {!isValidStorageUrl(item.url) ? (
                  // Dead blob/temp URL — show expired state
                  <div className="flex flex-col items-center justify-center gap-2 text-zinc-600 p-6">
                    <AlertTriangle className="w-8 h-8 text-zinc-700" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Expired<br/>Temporary URL</span>
                  </div>
                ) : item.type === 'image' ? (
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover opacity-80" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => {e.currentTarget.pause(); e.currentTarget.currentTime = 0;}} />
                )}

                <div className="absolute top-4 right-4">
                  {item.type === 'image' ? (
                    <ImageIcon className="w-5 h-5 text-white drop-shadow-lg" />
                  ) : (
                    <Video className="w-5 h-5 text-white drop-shadow-lg" />
                  )}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button
                    onClick={() => downloadFile(item)}
                    disabled={downloadingId === item.id || !isValidStorageUrl(item.url)}
                    className="p-3 bg-cyan-500 text-black rounded-full hover:bg-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isValidStorageUrl(item.url) ? 'Download' : 'Expired URL — cannot download'}
                  >
                    {downloadingId === item.id
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Download className="w-5 h-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-3 bg-zinc-800 text-white rounded-full hover:bg-red-500 transition-all"
                    title="Delete from archives"
                  >
                    <Trash2 className="w-5 h-5" />
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
