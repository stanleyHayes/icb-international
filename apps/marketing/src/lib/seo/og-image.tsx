import { ImageResponse } from 'next/og';

const NAVY_900 = '#06182b';
const GOLD_500 = '#c9a227';
const NAVY_50 = '#edf3f9';

/**
 * The shared Open Graph image.
 *
 * Generated at the edge with `next/og` so every route unfurls with brand art instead of a bare
 * link. Satori has no access to the app's CSS variables, so the brand tokens are repeated here
 * — navy ground, gold accent, the wordmark top left, the page's headline doing the talking.
 */
export function ogImage(headline: string, standfirst: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          backgroundColor: NAVY_900,
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: GOLD_500,
              color: NAVY_900,
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            I
          </div>
          <div style={{ color: NAVY_50, fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
            ICB
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ width: 96, height: 6, backgroundColor: GOLD_500, borderRadius: 3 }} />
          <div style={{ color: 'white', fontSize: 68, fontWeight: 800, lineHeight: 1.1 }}>
            {headline}
          </div>
          <div style={{ color: NAVY_50, fontSize: 30, lineHeight: 1.4, opacity: 0.85 }}>
            {standfirst}
          </div>
        </div>

        <div style={{ display: 'flex', color: GOLD_500, fontSize: 24, fontWeight: 600 }}>
          International Commercial Bank · Every posting traceable to the cent
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
