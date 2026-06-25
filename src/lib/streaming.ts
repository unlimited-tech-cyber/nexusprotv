export function isAzamCdnUrl(url: string): boolean {
  return /cdnedgch2\.azamtvltd\.co\.tz/i.test(url);
}

export function extractChannelSlug(url: string): string | null {
  const match = url.match(/\/live\/eds\/([^/]+)\/DASH\//i);
  return match ? match[1] : null;
}

export function buildPlaybackCandidates(url: string, token: string): string[] {
  const candidates = new Set<string>();
  if (!url) return [];

  candidates.add(url);

  if (isAzamCdnUrl(url)) {
    const slug = extractChannelSlug(url);
    if (slug) {
      const base = 'https://cdnedgch2.azamtvltd.co.tz';
      candidates.add(`${base}/tok_${token}/live/eds/${slug}/DASH/${slug}.mpd`);
      candidates.add(`${url}?cdntoken=${token}`);
    }
  }

  return Array.from(candidates);
}
