import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { motion } from 'motion/react';
import { Image as ImageIcon, Video, Download, Trash2, ExternalLink, RefreshCw } from 'lucide-react';

interface GalleryItem {
  id: string;
  created_at: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  settings: any;
}

export function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { error } = await supabase
        .from('studio_gallery')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
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
        <button 
          onClick={fetchGallery}
          className="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all text-zinc-400 hover:text-white"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
                {item.type === 'image' ? (
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
                  <a href={item.url} download target="_blank" rel="noreferrer" className="p-3 bg-cyan-500 text-black rounded-full hover:bg-cyan-400 transition-all">
                    <Download className="w-5 h-5" />
                  </a>
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
