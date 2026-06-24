import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tv2 } from 'lucide-react';
import Header from '@/components/Header';
import ChannelSlider from '@/components/ChannelSlider';
import BottomNav from '@/components/BottomNav';

interface Channel {
  id: string;
  name: string;
  img_url: string | null;
}

export default function Index() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchChannels(); }, []);

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('id, name, img_url').eq('active', true).order('sort_order');
    setChannels(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <ChannelSlider />

      <div className="px-3 py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary rounded-full glow-cyan" />
          <h2 className="text-sm font-black tracking-widest text-foreground uppercase">All Channels</h2>
          <span className="ml-auto text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {channels.length} Channels
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="cyber-card rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-2"><div className="h-2.5 bg-muted rounded w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Tv2 className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No channels yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {channels.map((ch) => (
              <Link key={ch.id} to={`/player/${ch.id}`} className="cyber-card rounded-xl overflow-hidden cursor-pointer group relative flex flex-col">
                {/* LIVE badge */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-destructive/90 backdrop-blur-sm text-destructive-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                  LIVE
                </div>
                {/* Fixed-height image box */}
                <div className="w-full h-28 bg-muted overflow-hidden">
                  {ch.img_url ? (
                    <img
                      src={ch.img_url}
                      alt={ch.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tv2 className="w-10 h-10 text-muted-foreground opacity-40" />
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-border">
                  <p className="text-[13px] font-bold text-foreground truncate leading-tight">{ch.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
