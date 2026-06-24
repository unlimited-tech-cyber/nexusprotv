import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, ExternalLink } from 'lucide-react';

interface Ad {
  id: string;
  image_url: string;
  link: string;
  description: string | null;
}

export default function AdOverlay() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [canSkip, setCanSkip] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fetchAd = async () => {
      const { data } = await supabase
        .from('ads')
        .select('*')
        .eq('active', true)
        .limit(10);
      if (data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)] as Ad;
        setAd(random);
        setVisible(true);
      }
    };
    fetchAd();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (countdown <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, countdown]);

  const skip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
  };

  const handleAdClick = () => {
    if (!ad) return;
    window.open(ad.link, '_blank', 'noopener,noreferrer');
  };

  if (!visible || !ad) return null;

  return (
    <>
      {/* Dim backdrop */}
      <div className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm" />

      {/* Ad Card */}
      <div className="fixed bottom-24 left-3 right-3 z-[100] max-w-sm mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>

          {/* AD label */}
          <div className="absolute top-2 left-2 z-10 bg-secondary text-secondary-foreground text-[9px] font-black px-1.5 py-0.5 rounded">
            AD
          </div>

          {/* Skip / Countdown */}
          <div className="absolute top-2 right-2 z-10">
            {canSkip ? (
              <button
                onClick={skip}
                className="flex items-center gap-1 bg-black/80 border border-white/20 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full backdrop-blur-sm active:scale-95 transition-transform"
              >
                <X className="w-3 h-3" />
                Skip
              </button>
            ) : (
              <div className="bg-black/80 border border-white/20 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full backdrop-blur-sm">
                {countdown}s
              </div>
            )}
          </div>

          {/* Image */}
          <div
            className="w-full cursor-pointer"
            style={{ aspectRatio: '16/9' }}
            onClick={handleAdClick}
          >
            <img
              src={ad.image_url}
              alt="Advertisement"
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>

          {/* Bottom info bar */}
          <div
            className="bg-card px-3 py-2.5 flex items-center gap-2 cursor-pointer active:bg-muted transition-colors"
            onClick={handleAdClick}
          >
            <div className="flex-1 min-w-0">
              {ad.description && (
                <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{ad.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground truncate">{ad.link}</p>
            </div>
            <div className="flex items-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0">
              <ExternalLink className="w-3 h-3" />
              Visit
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
