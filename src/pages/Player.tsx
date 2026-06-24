import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { X, Volume2, VolumeX, Crown, Loader2 } from 'lucide-react';

declare global {
  interface Window { shaka: any; Hls: any; }
}

interface Channel {
  id: string; name: string; type: string; url: string;
  kid: string | null; key: string | null; img_url: string | null;
  is_free: boolean;
}

// Key stored in localStorage when paywall was triggered
const PAYWALL_KEY = 'chtv_paywall_at';
const BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/** Returns true if the 24-hour block is still active */
function isBlockActive(): boolean {
  const stored = localStorage.getItem(PAYWALL_KEY);
  if (!stored) return false;
  return Date.now() - parseInt(stored) < BLOCK_DURATION;
}

/** Records the moment the paywall was triggered */
function recordPaywallHit() {
  localStorage.setItem(PAYWALL_KEY, Date.now().toString());
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [token, setToken] = useState('');
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trialLeft, setTrialLeft] = useState(30);
  const [trialDone, setTrialDone] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const shakaRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPremium = profile?.plan && profile.plan !== 'free';
  // blocked = paywall was seen in last 24 hours
  const blocked = !isPremium && !channel?.is_free && isBlockActive();

  useEffect(() => {
    loadScripts().then(fetchChannelAndToken);
    return cleanup;
  }, [id]);

  useEffect(() => {
    if (!channel || !videoRef.current) return;
    if (blocked) {
      // Still within 24h block — show paywall immediately, no trial
      setShowPaywall(true);
      setLoading(false);
    } else {
      startPlayback();
    }
  }, [channel, token]);

  // 30-second trial timer for non-premium, non-blocked, non-free users
  useEffect(() => {
    if (!isPremium && !blocked && channel && !channel.is_free && !trialDone) {
      timerRef.current = setInterval(() => {
        setTrialLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setTrialDone(true);
            recordPaywallHit(); // start 24h block from now
            setShowPaywall(true);
            if (videoRef.current) videoRef.current.pause();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [channel, isPremium, blocked, trialDone]);

  const loadScripts = async () => {
    const promises: Promise<void>[] = [];
    if (!window.shaka) promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js'));
    if (!window.Hls) promises.push(loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'));
    await Promise.all(promises);
  };

  const loadScript = (src: string): Promise<void> => new Promise((resolve) => {
    const s = document.createElement('script'); s.src = src; s.onload = () => resolve(); s.onerror = () => resolve(); document.head.appendChild(s);
  });

  const fetchChannelAndToken = async () => {
    const [cRes, tRes] = await Promise.all([
      supabase.from('channels').select('*').eq('id', id).single(),
      supabase.from('tokens').select('value').order('updated_at', { ascending: false }).limit(1).single(),
    ]);
    if (cRes.data) setChannel(cRes.data);
    if (tRes.data) setToken(tRes.data.value || '');
  };

  const cleanup = () => {
    if (shakaRef.current) { try { shakaRef.current.destroy(); } catch {} shakaRef.current = null; }
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (videoRef.current) { videoRef.current.src = ''; videoRef.current.load(); }
    
  };

  const startPlayback = async () => {
    if (!channel || !videoRef.current) return;
    cleanup();
    setLoading(true);

    const video = videoRef.current;

    try {
      if (channel.type === 'dash') {
        // Wait for shaka to be available
        let attempts = 0;
        while (!window.shaka && attempts < 20) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
        if (!window.shaka) {
          // fallback: try direct video src
          video.src = channel.url;
          video.play().catch(() => {});
          setLoading(false);
          return;
        }

        window.shaka.polyfill.installAll();
        const player = new window.shaka.Player(video);
        shakaRef.current = player;

        // Configure DRM ClearKey if available
        if (channel.kid && channel.key) {
          player.configure({
            drm: { clearKeys: { [channel.kid]: channel.key } },
          });
        }

        // Configure retry/network settings for resilience
        player.configure({
          streaming: {
            retryParameters: {
              maxAttempts: 5,
              baseDelay: 1000,
              backoffFactor: 1.5,
              fuzzFactor: 0.5,
            },
            bufferingGoal: 10,
            rebufferingGoal: 2,
          },
          manifest: {
            retryParameters: {
              maxAttempts: 5,
              baseDelay: 500,
            },
          },
        });

        // Use token for DASH streams
        const dashUrl = token ? `${channel.url}?cdntoken=${token}` : channel.url;
        await player.load(dashUrl);
        video.play().catch(() => {});

      } else {
        // HLS stream — wait for Hls.js to be ready
        let hlsAttempts = 0;
        while (!window.Hls && hlsAttempts < 20) {
          await new Promise(r => setTimeout(r, 200));
          hlsAttempts++;
        }

        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: false,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxBufferSize: 60 * 1000 * 1000,
            maxLoadingDelay: 8,
            fragLoadingTimeOut: 20000,
            manifestLoadingTimeOut: 20000,
            levelLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 6,
            manifestLoadingMaxRetry: 6,
            levelLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
            xhrSetup: (xhr: XMLHttpRequest) => {
              xhr.withCredentials = false;
            },
          });
          hlsRef.current = hls;

          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            video.play().catch(() => {});
          });

          hls.on(window.Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) {
              switch (data.type) {
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                  setTimeout(() => hls.startLoad(), 1000);
                  break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  // Destroy and retry after 3s
                  hls.destroy();
                  setTimeout(() => startPlayback(), 3000);
                  break;
              }
            }
          });

          hls.loadSource(channel.url);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS (Safari/iOS)
          video.src = channel.url;
          video.load();
          video.play().catch(() => {});
          setLoading(false);
        } else {
          video.src = channel.url;
          video.load();
          video.play().catch(() => {});
          setLoading(false);
        }
        return; // loading state handled by MANIFEST_PARSED event above
      }
    } catch {
      // Silently ignore errors
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button onClick={() => { cleanup(); navigate(-1); }} className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/40 transition-colors">
          <X className="w-5 h-5 text-primary" />
        </button>
        <span className="font-bold text-sm text-white truncate flex-1">{channel?.name || '...'}</span>
        {/* LIVE badge */}
        <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          LIVE
        </span>
        {/* Trial countdown - only for non-free, non-premium channels */}
        {!isPremium && !blocked && !trialDone && channel && !channel.is_free && (
          <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full">
            {trialLeft}s
          </span>
        )}
        {channel?.is_free && (
          <span className="text-xs font-black text-primary bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-full">
            FREE
          </span>
        )}
        <button
          onClick={() => {
            if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(!muted); }
          }}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
        >
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          className="w-full h-full max-h-full object-contain"
        />

        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-10 h-10 text-primary animate-spin opacity-80" />
          </div>
        )}

        {/* Paywall overlay */}
        {showPaywall && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 px-6">
            <div className="w-full max-w-sm rounded-2xl p-6 text-center border border-primary/40 bg-black/80 backdrop-blur-sm shadow-[0_0_40px_rgba(220,38,38,0.2)]">
              {/* Brand */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-black text-xs">NX</span>
                </div>
                <span className="text-white font-black text-base tracking-widest">NEXUS PRO TV</span>
              </div>

              <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-black text-white mb-1">Muda wa Majaribio Umeisha</h2>
              <p className="text-muted-foreground text-sm mb-5">Lipia kufurahia burudani bila kikwazo kwenye NEXUS PRO TV</p>

              <div className="space-y-2 mb-5">
                {[
                  { label: 'Siku 1', price: '2,000 TZS' },
                  { label: 'Wiki 1', price: '3,500 TZS' },
                  { label: 'Wiki 2', price: '7,000 TZS' },
                  { label: 'Mwezi 1', price: '15,000 TZS' },
                ].map((p) => (
                  <div key={p.label} className="flex justify-between items-center bg-primary/5 rounded-xl px-4 py-2.5 border border-primary/20">
                    <span className="text-white font-bold text-sm">{p.label}</span>
                    <span className="text-primary font-black text-sm">{p.price}</span>
                  </div>
                ))}
              </div>

              {!user ? (
                <button onClick={() => navigate('/login')} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black mb-2 hover:bg-primary/80 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                  Jisajili / Ingia Kwanza
                </button>
              ) : (
                <button onClick={() => navigate('/payment')} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black mb-2 hover:bg-primary/80 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                  LIPIA SASA
                </button>
              )}
              <button onClick={() => { cleanup(); navigate(-1); }} className="w-full py-2 text-muted-foreground text-sm hover:text-white transition-colors">
                Rudi Nyuma
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
