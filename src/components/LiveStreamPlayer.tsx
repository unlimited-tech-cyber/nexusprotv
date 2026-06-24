import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    shaka: any;
  }
}

interface LiveStreamPlayerProps {
  /** Channel slug/name for URL construction, e.g. "AzamOne" */
  channel: string;
  /** Optional DRM ClearKey config */
  drm?: { kid: string; key: string } | null;
  /** Called when player encounters a fatal error */
  onError?: (msg: string) => void;
  /** Called when playback starts */
  onPlaying?: () => void;
}

/**
 * Fetches a fresh CDN token from the server-side proxy.
 * Cache-busted with timestamp. Never caches in browser.
 */
async function fetchCdnToken(): Promise<{ token: string; exp: number; cdnHost: string }> {
  const res = await fetch('/api/cdn-token?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Loads Shaka Player script if not already loaded.
 */
function loadShakaScript(): Promise<void> {
  if (window.shaka) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Shaka Player'));
    document.head.appendChild(s);
  });
}

export default function LiveStreamPlayer({ channel, drm, onError, onPlaying }: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const latestTokenRef = useRef<string>('');
  const cdnHostRef = useRef<string>('https://cdnedgch2.azamtvltd.co.tz');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const loadingRef = useRef(true);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Fetches token and stores in ref (no re-render).
   */
  const refreshToken = useCallback(async () => {
    if (cancelledRef.current) return;
    try {
      const data = await fetchCdnToken();
      if (!cancelledRef.current) {
        latestTokenRef.current = data.token;
        cdnHostRef.current = data.cdnHost;
      }
    } catch (err: any) {
      console.warn('[LiveStreamPlayer] Token refresh failed:', err.message);
    }
  }, []);

  /**
   * Build the DASH manifest URL for a channel.
   */
  const buildManifestUrl = useCallback((token: string) => {
    const host = cdnHostRef.current;
    return `${host}/tok_${token}/live/eds/${channel}/DASH/${channel}.mpd`;
  }, [channel]);

  /**
   * Initialize player: load Shaka, fetch token, configure, start playback.
   */
  const initPlayer = useCallback(async () => {
    cancelledRef.current = false;

    try {
      // Load Shaka
      await loadShakaScript();
      if (cancelledRef.current) return;

      window.shaka.polyfill.installAll();
      if (!window.shaka.Player.isBrowserSupported()) {
        onError?.('Browser does not support Shaka Player');
        return;
      }

      // Fetch initial token
      await refreshToken();
      if (cancelledRef.current || !latestTokenRef.current) {
        onError?.('Could not fetch CDN token');
        return;
      }

      const video = videoRef.current;
      if (!video || cancelledRef.current) return;

      // Create Shaka player
      const player = new window.shaka.Player(video);
      playerRef.current = player;

      // Configure DRM if provided
      if (drm?.kid && drm?.key) {
        player.configure({
          drm: { clearKeys: { [drm.kid]: drm.key } },
        });
      }

      // Streaming / retry config
      player.configure({
        streaming: {
          retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5 },
          bufferingGoal: 10,
          rebufferingGoal: 2,
        },
        manifest: {
          retryParameters: { maxAttempts: 5, baseDelay: 500, backoffFactor: 2, fuzzFactor: 0.5 },
        },
      });

      // ─── REQUEST FILTER: inject fresh token into EVERY chunk request ───
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

      // Error listener
      player.addEventListener('error', (event: any) => {
        const detail = event.detail;
        console.error('[Shaka] Error code:', detail?.code, detail?.message);
        onError?.(`Playback error: ${detail?.code || 'unknown'}`);
      });

      // Build manifest URL and load
      const manifestUrl = buildManifestUrl(latestTokenRef.current);
      if (cancelledRef.current) return;

      await player.load(manifestUrl);
      if (cancelledRef.current) return;

      loadingRef.current = false;
      video.play().catch(() => {});
      onPlaying?.();

      // ─── Token refresh interval: every 2 minutes ───
      intervalRef.current = setInterval(() => {
        if (!cancelledRef.current) refreshToken();
      }, 2 * 60 * 1000);

    } catch (err: any) {
      if (!cancelledRef.current) {
        console.error('[LiveStreamPlayer] Init failed:', err);
        onError?.(err.message || 'Player initialization failed');
      }
    }
  }, [channel, drm, refreshToken, buildManifestUrl, onError, onPlaying]);

  /**
   * Cleanup: destroy player, clear interval, set cancelled flag.
   */
  const destroyPlayer = useCallback(() => {
    cancelledRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }

    latestTokenRef.current = '';
  }, []);

  // Mount / channel change → init player
  useEffect(() => {
    initPlayer();
    return () => destroyPlayer();
  }, [channel, initPlayer, destroyPlayer]);

  return (
    <div ref={videoContainerRef} className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full max-h-full object-contain"
      />
      {/* Loading indicator shown until onPlaying fires */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" id="shaka-loading">
        <Loader2 className="w-10 h-10 text-primary animate-spin opacity-80" />
      </div>
    </div>
  );
}
