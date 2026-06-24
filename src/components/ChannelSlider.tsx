import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SliderImage {
  id: string;
  img_url: string;
  caption: string | null;
}

const FALLBACK_SLIDES = [
  { id: '1', img_url: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80', caption: 'Live Sports' },
  { id: '2', img_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=800&q=80', caption: 'Burudani' },
  { id: '3', img_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80', caption: 'Sinema Zetu' },
];

export default function ChannelSlider() {
  const [slides, setSlides] = useState<SliderImage[]>([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSlides();
  }, []);

  useEffect(() => {
    const total = slides.length || FALLBACK_SLIDES.length;
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % total), 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides]);

  const fetchSlides = async () => {
    const { data } = await supabase.from('slider_images').select('*').eq('active', true).order('sort_order');
    if (data && data.length > 0) setSlides(data);
    else setSlides(FALLBACK_SLIDES);
  };

  const items = slides.length > 0 ? slides : FALLBACK_SLIDES;
  const total = items.length;

  const prev = () => { if (timerRef.current) clearInterval(timerRef.current); setCurrent((c) => (c - 1 + total) % total); };
  const next = () => { if (timerRef.current) clearInterval(timerRef.current); setCurrent((c) => (c + 1) % total); };

  return (
    <div className="relative w-full h-44 overflow-hidden rounded-none bg-muted">
      {/* Slides */}
      {items.map((slide, i) => (
        <div
          key={slide.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img src={slide.img_url} alt={slide.caption || ''} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          {slide.caption && (
            <div className="absolute bottom-4 left-4">
              <span className="text-lg font-black text-foreground text-glow-cyan tracking-wide">{slide.caption}</span>
            </div>
          )}
        </div>
      ))}

      {/* Controls */}
      <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-primary/30 p-1.5 rounded-full transition-colors">
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>
      <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-primary/30 p-1.5 rounded-full transition-colors">
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 right-4 flex gap-1.5">
        {items.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-primary w-4' : 'bg-foreground/40'}`} />
        ))}
      </div>
    </div>
  );
}
