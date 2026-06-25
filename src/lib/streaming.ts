export function isAzamCdnUrl(url: string): boolean {
  return /cdnedgch2\.azamtvltd\.co\.tz/i.test(url);
}

export function extractChannelSlug(url: string): string | null {
  const match = url.match(/\/live\/eds\/([^/]+)\/DASH\//i);
  return match ? match[1] : null;
}

export function buildPlaybackCandidates(url: string, token: string): string[] {
  if (!url) return [];
  const candidates: string[] = [];

  if (isAzamCdnUrl(url)) {
    const slug = extractChannelSlug(url);
    if (slug && token) {
      const base = 'https://cdnedgch2.azamtvltd.co.tz';
      candidates.push(`${base}/tok_${token}/live/eds/${slug}/DASH/${slug}.mpd`);
      candidates.push(`${url}?cdntoken=${token}`);
    }
  }
  
  if (!candidates.includes(url)) {
    candidates.push(url);
  }

  return candidates;
}
