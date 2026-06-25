import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildPlaybackCandidates, extractChannelSlug, isAzamCdnUrl } from '@/lib/streaming';
import { X, Volume2, VolumeX, Crown, Loader2 } from 'lucide-react';

declare global {
  interface Window { shaka: any; Hls: any; }
}

interface Channel {
  id: string; name: string; type: string; url: string;
  kid: string | null; key: string | null; img_url: string | null;
  is_free: boolean;
}

const CDN_HOST = 'https://cdnedgch2.azamtvltd.co.tz';

// Key stored in localStorage when paywall was triggered
const PAYWALL_KEY = 'chtv_paywall_at';
const BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function isBlockActive(): boolean {
  const stored = localStorage.getItem(PAYWALL_KEY);
  if (!stored) return false;
  return Date.now() - parseInt(stored) < BLOCK_DURATION;
}

function recordPaywallHit() {
  localStorage.setItem(PAYWALL_KEY, Date.now().toString());
}

/** Fetch fresh CDN token from our server-side proxy */
async function fetchCdnToken(): Promise<{ token: string; exp: number; cdnHost: string }> {
  const res = await fetch('/api/cdn-token?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  return res.json();
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trialLeft, setTrialLeft] = useState(30);
  const [trialDone, setTrialDone] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Token stored in ref — no re-renders on refresh
  const latestTokenRef = useRef<string>('');
  const tokenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const shakaRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const isPremium = profile?.plan && profile.plan !== 'free';
  const blocked = !isPremium && !channel?.is_free && isBlockActive();

  // ─── MOUNT: load scripts + fetch channel ─────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;
    loadScripts().then(fetchChannel);
    return () => {
      cancelledRef.current = true;
      cleanup();
    };
  }, [id]);

  // ─── PLAYBACK trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (!channel || !videoRef.current) return;
    if (blocked) {
      setShowPaywall(true);
      setLoading(false);
      setErrorMessage(null);
    } else {
      setErrorMessage(null);
      startPlayback();
    }
  }, [channel]);

  // ─── 30-second trial timer ───────────────────────────────────────────
  useEffect(() => {
    if (!isPremium && !blocked && channel && !channel.is_free && !trialDone) {
      timerRef.current = setInterval(() => {
        setTrialLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setTrialDone(true);
            recordPaywallHit();
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

  // ─── Helper: load external scripts ───────────────────────────────────
  const loadScripts = async () => {
    const promises: Promise<void>[] = [];
    if (!window.shaka) promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js'));
    if (!window.Hls) promises.push(loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'));
    await Promise.all(promises);
  };

  const loadScript = (src: string): Promise<void> => new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });

  // ─── Fetch channel from Supabase ─────────────────────────────────────
  const fetchChannel = async () => {
    const { data, error } = await supabase.from('channels').select('*').eq('id', id).maybeSingle();
    if (!error && data && !cancelledRef.current) setChannel(data);
  };

  // ─── Cleanup ─────────────────────────────────────────────────────────
  const cleanup = () => {
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (tokenIntervalRef.current) {
      clearInterval(tokenIntervalRef.current);
      tokenIntervalRef.current = null;
    }
    if (shakaRef.current) {
      try { shakaRef.current.destroy(); } catch {}
      shakaRef.current = null;
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
    latestTokenRef.current = '';
  };

  // ─── Main playback logic ─────────────────────────────────────────────
  const startPlayback = async () => {
    if (!channel || !videoRef.current || cancelledRef.current) return;
    cleanup();
    cancelledRef.current = false;
    setLoading(true);
    setErrorMessage(null);
    setShowPaywall(false);

    const video = videoRef.current;
    const isAzam = isAzamCdnUrl(channel.url);
    const channelSlug = isAzam ? extractChannelSlug(channel.url) : null;
    video.muted = true;

    try {
      if (channel.type === 'dash') {
        // Wait for Shaka
        let attempts = 0;
        while (!window.shaka && attempts < 20) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
        if (!window.shaka || cancelledRef.current) {
          video.src = channel.url;
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
          setLoading(false);
          return;
        }

        window.shaka.polyfill.installAll();
        const player = new window.shaka.Player(video);
        shakaRef.current = player;

        // ClearKey DRM
        if (channel.kid && channel.key) {
          player.configure({ drm: { clearKeys: { [channel.kid]: channel.key } } });
        }

        // Streaming config
        player.configure({
          streaming: {
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 1.5, fuzzFactor: 0.5 },
            bufferingGoal: 10,
            rebufferingGoal: 2,
          },
          manifest: {
            retryParameters: { maxAttempts: 5, baseDelay: 500 },
          },
        });

        // ─── AzamTV CDN: fetch token + request filter + refresh ───
        let manifestUrl = channel.url;

        if (isAzam && channelSlug) {
          // Fetch initial fresh token
          try {
            const tokenData = await fetchCdnToken();
            if (cancelledRef.current) return;
            latestTokenRef.current = tokenData.token;

            // Build manifest URL with fresh token
            manifestUrl = `${CDN_HOST}/tok_${tokenData.token}/live/eds/${channelSlug}/DASH/${channelSlug}.mpd`;
          } catch (err) {
            console.warn('[Player] Token fetch failed, using original URL:', err);
            manifestUrl = channel.url;
          }

          // Register request filter: inject LATEST token into every request
          const netEngine = player.getNetworkingEngine();
          if (netEngine) {
            netEngine.registerRequestFilter((_type: any, request: any) => {
              if (latestTokenRef.current && request.uris?.[0]) {
                const u = new URL(request.uris[0]);
                u.searchParams.set('cdntoken', latestTokenRef.current);
                request.uris[0] = u.toString();
              }
            });
          }

          // Token refresh every 2 minutes
          tokenIntervalRef.current = setInterval(async () => {
            if (cancelledRef.current) return;
            try {
              const data = await fetchCdnToken();
              if (!cancelledRef.current) {
                latestTokenRef.current = data.token;
              }
            } catch (err) {
              console.warn('[Player] Token refresh failed:', err);
            }
          }, 2 * 60 * 1000);
        }

        // Load and play
        const manifestCandidates = buildPlaybackCandidates(channel.url, latestTokenRef.current);
        let loaded = false;
        for (const candidateUrl of manifestCandidates) {
          try {
            await player.load(candidateUrl);
            loaded = true;
            break;
          } catch (loadErr) {
            console.warn('[Player] DASH candidate failed:', candidateUrl, loadErr);
          }
        }

        if (cancelledRef.current) return;
        if (!loaded) {
          setErrorMessage('This stream is currently unavailable. Please try another channel.');
          setLoading(false);
          return;
        }

        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });

        // Error handler
        player.addEventListener('error', (event: any) => {
          console.error('[Shaka] Error:', event.detail?.code);
          setErrorMessage('Playback failed. Trying a fallback source.');
        });

      } else {
        // ─── HLS streams ───────────────────────────────────────────
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
            xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = false; },
          });
          hlsRef.current = hls;

          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            if (fallbackTimerRef.current) {
              window.clearTimeout(fallbackTimerRef.current);
              fallbackTimerRef.current = null;
            }
            setLoading(false);
            video.play().catch(() => {
              video.muted = true;
              video.play().catch(() => {});
            });
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
                  hls.destroy();
                  setTimeout(() => startPlayback(), 3000);
                  break;
              }
            }
          });

          fallbackTimerRef.current = window.setTimeout(() => {
            if (cancelledRef.current) return;
            if (video.readyState < 2) {
              video.src = channel.url;
              video.load();
              video.play().catch(() => {
                video.muted = true;
                video.play().catch(() => {});
              });
              setLoading(false);
              setErrorMessage('The stream is taking too long to load. Trying a direct playback fallback.');
            }
          }, 6000);

          hls.loadSource(channel.url);
          hls.attachMedia(video);
          return; // loading handled by MANIFEST_PARSED
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = channel.url;
          video.load();
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        } else {
          video.src = channel.url;
          video.load();
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      }
    } catch (err) {
      console.error('[Player] Playback error:', err);
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
        <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          LIVE
        </span>
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
          onLoadedData={() => setLoading(false)}
          onPlaying={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setErrorMessage('This stream could not be played. Please try another channel.');
          }}
          className="w-full h-full max-h-full object-contain"
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-10 h-10 text-primary animate-spin opacity-80" />
          </div>
        )}

        {errorMessage && !loading && (
          <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-primary/30 bg-black/80 px-3 py-2 text-center text-sm text-white">
            {errorMessage}
          </div>
        )}

        {showPaywall && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 px-6">
            <div className="w-full max-w-sm rounded-2xl p-6 text-center border border-primary/40 bg-black/80 backdrop-blur-sm shadow-[0_0_40px_rgba(220,38,38,0.2)]">
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
