import type { Request, Response } from 'express';

/**
 * Server-side proxy for CDN token.
 * Calls the token service with the secret API key and returns
 * { token, exp, cdnHost } to the frontend.
 *
 * Cache: AT MOST 15 seconds in-memory. Response always has Cache-Control: no-store.
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

export async function cdnTokenHandler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  // Return cached token if still fresh (< 15s old)
  if (isCacheValid() && cache) {
    return res.json({
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

    const data = await upstream.json() as { token: string; exp: number; cdnHost: string };

    // Update cache
    cache = {
      token: data.token,
      exp: data.exp,
      cdnHost: data.cdnHost,
      fetchedAt: Date.now(),
    };

    return res.json({
      token: data.token,
      exp: data.exp,
      cdnHost: data.cdnHost,
    });
  } catch (err: any) {
    console.error('[cdn-token] Fetch failed:', err.message);
    return res.status(502).json({ error: 'Failed to reach token service' });
  }
}
