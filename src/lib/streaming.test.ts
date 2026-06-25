import { describe, expect, it } from 'vitest';
import { buildPlaybackCandidates, extractChannelSlug, isAzamCdnUrl } from './streaming';

describe('streaming helpers', () => {
  it('builds fallback candidates for Azam CDN streams', () => {
    const candidates = buildPlaybackCandidates('https://cdnedgch2.azamtvltd.co.tz/live/eds/AzamSport1/DASH/AzamSport1.mpd', 'abc123');

    expect(candidates).toEqual(expect.arrayContaining([
      'https://cdnedgch2.azamtvltd.co.tz/live/eds/AzamSport1/DASH/AzamSport1.mpd',
      'https://cdnedgch2.azamtvltd.co.tz/tok_abc123/live/eds/AzamSport1/DASH/AzamSport1.mpd',
      'https://cdnedgch2.azamtvltd.co.tz/live/eds/AzamSport1/DASH/AzamSport1.mpd?cdntoken=abc123',
    ]));
  });

  it('detects Azam CDN URLs and extracts channel slugs', () => {
    expect(isAzamCdnUrl('https://cdnedgch2.azamtvltd.co.tz/live/eds/AzamOne/DASH/AzamOne.mpd')).toBe(true);
    expect(extractChannelSlug('https://cdnedgch2.azamtvltd.co.tz/live/eds/AzamOne/DASH/AzamOne.mpd')).toBe('AzamOne');
  });
});
