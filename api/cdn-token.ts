import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: /api/cdn-token
 * 
 * Proxies CDN token requests to the upstream token service.
 * API key stays server-side — never exposed to browser.
 * Cache: AT MOST 15 seconds in-memory per instance.
 */

interface TokenCache {
  token: string;
  exp: number;
  cdnHost: string;
  fetchedAt: number;
}

let cache: TokenCache | null = null;
const MAX_CACHE_AGE_MS = 15_000; // 15 seconds

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < MAX_CACHE_AGE_MS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Return cached token if still fresh (< 15s old)
  if (isCacheValid() && cache) {
    return res.status(200).json({
      token: cache.token,
      exp: cache.exp,
      cdnHost: cache.cdnHost,
    });
  }

  const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL;
  const TOKEN_SERVICE_API_KEY = process.env.TOKEN_SERVICE_API_KEY;

  if (!TOKEN_SERVICE_URL || !TOKEN_SERVICE_API_KEY) {
    return res.status(500).json({
      error: 'Token service not configured. Set TOKEN_SERVICE_URL and TOKEN_SERVICE_API_KEY env vars.',
    });
  }

  try {
    const upstream = await fetch(`${TOKEN_SERVICE_URL}/api/token`, {
      headers: { 'X-Api-Key': TOKEN_SERVICE_API_KEY },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[cdn-token] Upstream error:', upstream.status, text);
      return res.status(upstream.status).json({ error: 'Token service error', detail: text });
    }

    const data = (await upstream.json()) as { token: string; exp: number; cdnHost: string };

    // Update cache
    cache = {
      token: data.token,
      exp: data.exp,
      cdnHost: data.cdnHost,
      fetchedAt: Date.now(),
    };

    return res.status(200).json({
      token: data.token,
      exp: data.exp,
      cdnHost: data.cdnHost,
    });
  } catch (err: any) {
    console.error('[cdn-token] Fetch failed:', err.message);
    return res.status(502).json({ error: 'Failed to reach token service' });
  }
}
